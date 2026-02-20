"""
Voxel Agent panel for FiftyOne.

Provides a production-grade AI agent panel with Claude SDK streaming,
MCP tool connectivity, skill injection, and guardrail middleware.

| Copyright 2017-2026, Voxel51, Inc.
| `voxel51.com <https://voxel51.com/>`_
|
"""

import concurrent.futures
import json
import logging
import os
import subprocess
import threading
import uuid
from pathlib import Path

import fiftyone.operators as foo
import fiftyone.operators.types as types
import fiftyone.core.utils as fou

anthropic = fou.lazy_import("anthropic")

logger = logging.getLogger(__name__)

PLUGIN_NAME = "@adonaivera/claude-agent"
DEFAULT_MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 8192

DEFAULT_SKILLS_DIR = os.path.expanduser("~/.fiftyone/skills")
SKILLS_REPO_URL = "https://github.com/voxel51/fiftyone-skills"

_pending_operations = {}


# ---------------------------------------------------------------------------
# Guardrail Layer
# ---------------------------------------------------------------------------


class GuardrailLayer:
    """Classifies tool calls as block / confirm / allow.

    Decisions are based on tool name and input patterns defined at the
    class level. Subclass and override the class attributes to customize
    behavior for a specific deployment.
    """

    BLOCKED_TOOL_NAMES = frozenset(
        {
            "execute_shell",
            "run_command",
            "system_call",
            "drop_collection",
            "drop_database",
            "raw_mongodb",
        }
    )

    BLOCKED_INPUT_SUBSTRINGS = [
        "rm -rf",
        "drop table",
        "delete *",
        "; drop",
        "--drop",
    ]

    CONFIRM_TOOL_NAMES = frozenset({"close_app", "disable_plugin"})

    CONFIRM_OPERATOR_KEYWORDS = [
        "delete",
        "remove",
        "clear",
        "overwrite",
        "truncate",
        "merge",
        "reset",
        "purge",
        "wipe",
    ]

    def check(self, tool_name, tool_input):
        """Classify a tool call as block, confirm, or allow.

        Args:
            tool_name: the tool name string
            tool_input: dict of tool parameters

        Returns:
            ``"block"``, ``"confirm"``, or ``"allow"``
        """
        if tool_name in self.BLOCKED_TOOL_NAMES:
            return "block"

        input_str = json.dumps(tool_input).lower()
        for pattern in self.BLOCKED_INPUT_SUBSTRINGS:
            if pattern in input_str:
                return "block"

        if tool_name in self.CONFIRM_TOOL_NAMES:
            return "confirm"

        if tool_name == "execute_operator":
            op_name = str(tool_input.get("operator_name", "")).lower()
            for kw in self.CONFIRM_OPERATOR_KEYWORDS:
                if kw in op_name:
                    return "confirm"

        return "allow"

    def get_risk_level(self, tool_name, tool_input):
        """Return the risk level for a tool requiring confirmation.

        Args:
            tool_name: the tool name string
            tool_input: dict of tool parameters

        Returns:
            ``"high"`` or ``"medium"``
        """
        if tool_name in self.CONFIRM_TOOL_NAMES:
            return "high"

        op_name = str(tool_input.get("operator_name", "")).lower()
        if any(kw in op_name for kw in ["delete", "drop", "purge", "wipe"]):
            return "high"

        return "medium"

    def get_block_reason(self, tool_name, tool_input):
        """Return a human-readable block reason for the tool call.

        Args:
            tool_name: the tool name string
            tool_input: dict of tool parameters

        Returns:
            a reason string
        """
        if tool_name in self.BLOCKED_TOOL_NAMES:
            return "Tool '%s' is blocked by safety policy." % tool_name

        input_str = json.dumps(tool_input).lower()
        for pattern in self.BLOCKED_INPUT_SUBSTRINGS:
            if pattern in input_str:
                return "Input contains blocked pattern: '%s'." % pattern

        return "Operation blocked by guardrails."

    def get_confirmation_message(self, tool_name, tool_input):
        """Return a human-readable description for the confirmation dialog.

        Args:
            tool_name: the tool name string
            tool_input: dict of tool parameters

        Returns:
            a description string
        """
        if tool_name == "close_app":
            return "This will close the FiftyOne App session."

        if tool_name == "disable_plugin":
            plugin = tool_input.get("plugin_name", "unknown")
            return "This will disable plugin '%s'." % plugin

        if tool_name == "execute_operator":
            op_name = tool_input.get("operator_name", "unknown")
            return (
                "This will execute the '%s' operator, which may modify "
                "or delete data." % op_name
            )

        return (
            "The operation '%s' may modify data and cannot be easily "
            "undone." % tool_name
        )


# ---------------------------------------------------------------------------
# MCP Client Manager
# ---------------------------------------------------------------------------


def _run_in_new_thread(coro):
    """Run an async coroutine in a dedicated thread with its own event loop.

    This avoids conflicts with any existing event loops in the calling
    thread (e.g. those created by FiftyOne's async infrastructure).

    Args:
        coro: the coroutine to run

    Returns:
        the coroutine result
    """
    import asyncio

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(asyncio.run, coro)
        return future.result(timeout=60)


class MCPClientManager:
    """Manages a connection to an MCP server subprocess via stdio JSON-RPC.

    Each call to :meth:`list_tools` or :meth:`call_tool` starts a fresh
    subprocess connection. This is less efficient than a persistent
    connection but is simpler and avoids async context-manager complexity.

    Args:
        command: the command used to launch the server (e.g. ``"python"``)
        args: list of args passed to the server command
    """

    def __init__(self, command, args):
        self.command = command
        self.args = args
        self._tools_cache = None

    def list_tools(self):
        """Return available MCP tools in Anthropic tool format.

        Results are cached after the first successful call.

        Returns:
            list of tool dicts with ``name``, ``description``,
            and ``input_schema`` keys
        """
        if self._tools_cache is not None:
            return self._tools_cache

        try:
            mcp_tools = _run_in_new_thread(self._async_list_tools())
            self._tools_cache = [_mcp_to_anthropic_tool(t) for t in mcp_tools]
            logger.info("Loaded %d MCP tools", len(self._tools_cache))
            return self._tools_cache
        except Exception as e:
            logger.warning("Failed to load MCP tools: %s", e)
            return []

    def call_tool(self, name, arguments):
        """Execute a tool and return its result as a string.

        Args:
            name: the tool name
            arguments: dict of tool arguments

        Returns:
            the tool result string
        """
        try:
            return _run_in_new_thread(self._async_call_tool(name, arguments))
        except Exception as e:
            logger.warning("Tool call error (%s): %s", name, e)
            return "Error calling %s: %s" % (name, str(e))

    async def _async_list_tools(self):
        try:
            from mcp.client.session import ClientSession
            from mcp.client.stdio import stdio_client, StdioServerParameters
        except ImportError:
            return []

        params = StdioServerParameters(
            command=self.command, args=self.args
        )
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.list_tools()
                return list(result.tools)

    async def _async_call_tool(self, name, arguments):
        try:
            from mcp.client.session import ClientSession
            from mcp.client.stdio import stdio_client, StdioServerParameters
        except ImportError:
            return "MCP package not available."

        params = StdioServerParameters(
            command=self.command, args=self.args
        )
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool(name, arguments)
                return "\n".join(
                    c.text for c in result.content if hasattr(c, "text")
                ) or "(no output)"


def _mcp_to_anthropic_tool(mcp_tool):
    """Convert an MCP tool to Anthropic API tool format.

    Args:
        mcp_tool: an MCP tool object or dict

    Returns:
        a dict with ``name``, ``description``, and ``input_schema``
    """
    if hasattr(mcp_tool, "model_dump"):
        data = mcp_tool.model_dump()
    elif hasattr(mcp_tool, "dict"):
        data = mcp_tool.dict()
    else:
        data = dict(mcp_tool)

    return {
        "name": data.get("name", ""),
        "description": data.get("description", ""),
        "input_schema": data.get(
            "inputSchema", {"type": "object", "properties": {}}
        ),
    }


# ---------------------------------------------------------------------------
# Skills Loader
# ---------------------------------------------------------------------------


def _ensure_skills_dir(skills_dir):
    """Ensure the skills directory exists, cloning the repo if needed.

    If the directory does not exist and git is available, clones
    ``https://github.com/voxel51/fiftyone-skills`` into ``skills_dir``.

    Args:
        skills_dir: :class:`pathlib.Path` to the skills directory
    """
    if skills_dir.exists():
        return

    logger.info(
        "Skills directory not found at %s. Cloning %s …",
        skills_dir,
        SKILLS_REPO_URL,
    )
    try:
        skills_dir.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["git", "clone", "--depth", "1", SKILLS_REPO_URL, str(skills_dir)],
            check=True,
            capture_output=True,
            timeout=60,
        )
        logger.info("Cloned fiftyone-skills to %s", skills_dir)
    except Exception as e:
        logger.warning("Failed to clone fiftyone-skills: %s", e)


class SkillsLoader:
    """Loads skill markdown files from the fiftyone-skills directory.

    Args:
        skills_dir: path to the directory containing skill subdirectories.
            Each subdirectory must contain a ``SKILL.md`` file.
    """

    def __init__(self, skills_dir=None):
        self.skills_dir = Path(skills_dir or DEFAULT_SKILLS_DIR)

    def load_all(self):
        """Load all available skills from disk.

        If the skills directory does not exist, attempts to clone the
        official fiftyone-skills repository automatically.

        Returns:
            dict mapping skill name to markdown content
        """
        _ensure_skills_dir(self.skills_dir)

        skills = {}
        if not self.skills_dir.exists():
            return skills

        for skill_dir in sorted(self.skills_dir.iterdir()):
            if not skill_dir.is_dir():
                continue

            skill_file = skill_dir / "SKILL.md"
            if skill_file.exists():
                try:
                    content = skill_file.read_text(encoding="utf-8")
                    skills[skill_dir.name] = content
                except Exception as e:
                    logger.warning(
                        "Failed to load skill %s: %s", skill_dir.name, e
                    )

        return skills

    def build_system_prompt(self, active_skills, fo_context):
        """Build the full system prompt for Claude.

        Args:
            active_skills: list of enabled skill names
            fo_context: FiftyOne dataset context string

        Returns:
            the system prompt string
        """
        base = (
            "You are a production-grade AI agent embedded in the FiftyOne "
            "computer vision platform. You have access to FiftyOne tools via "
            "MCP and can help users explore datasets, run models, manage "
            "annotations, and more.\n\n"
            "Guidelines:\n"
            "- Use MCP tools to interact with FiftyOne (list_datasets, "
            "dataset_summary, execute_operator, etc.)\n"
            "- Prefer read operations before write operations\n"
            "- Always explain what you are doing before executing tools\n"
            "- Present results in a clear, structured format using markdown\n"
            "- For bulk modifications, summarize what will change and confirm "
            "with the user\n"
        )

        if fo_context:
            base += "\n## Current FiftyOne Context\n%s\n" % fo_context

        if active_skills:
            all_skills = self.load_all()
            skill_sections = []
            for skill_name in active_skills:
                if skill_name in all_skills:
                    skill_sections.append(
                        "\n## Skill: %s\n%s\n"
                        % (skill_name, all_skills[skill_name])
                    )

            if skill_sections:
                base += "\n## Active Skills\n"
                base += (
                    "You have the following specialized skills available:\n"
                )
                base += "".join(skill_sections)

        return base


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _get_api_key(ctx):
    """Get the Anthropic API key from secrets or environment.

    Args:
        ctx: the operator execution context

    Returns:
        the API key string, or ``None`` if not found
    """
    api_key = ctx.secrets.get("ANTHROPIC_API_KEY")
    if not api_key:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
    return api_key


def _get_skills_dir(ctx):
    """Resolve the skills directory path.

    Resolution order:
    1. ``FIFTYONE_SKILLS_DIR`` plugin secret
    2. ``FIFTYONE_SKILLS_DIR`` environment variable
    3. ``~/.fiftyone/skills`` (default)

    Args:
        ctx: the operator execution context

    Returns:
        the resolved skills directory path string
    """
    path = ctx.secrets.get("FIFTYONE_SKILLS_DIR")
    if not path:
        path = os.environ.get("FIFTYONE_SKILLS_DIR")
    if not path:
        path = DEFAULT_SKILLS_DIR
    return path


def _build_fo_context(ctx):
    """Build a FiftyOne dataset context string for the system prompt.

    Args:
        ctx: the operator execution context

    Returns:
        a context description string
    """
    if not ctx.dataset:
        return "No dataset currently loaded."

    try:
        ds = ctx.dataset
        context = (
            "Dataset: '%s'\nSamples: %d\nMedia type: %s"
            % (ds.name, len(ds), ds.media_type)
        )
        fields = list(ds.get_field_schema().keys())
        if fields:
            context += "\nFields: %s" % ", ".join(fields[:20])
        return context
    except Exception:
        return "Dataset context unavailable."


def _get_mcp_manager(mcp_config):
    """Create an MCPClientManager from a config dict.

    Defaults to the ``fiftyone-mcp`` command installed by the
    ``fiftyone-mcp-server`` package (``pip install fiftyone-mcp-server``).

    Args:
        mcp_config: dict with optional ``command``, ``args``, and
            ``enabled`` keys

    Returns:
        an :class:`MCPClientManager`, or ``None`` if disabled
    """
    if not mcp_config:
        mcp_config = {}

    enabled = mcp_config.get("enabled", True)
    if not enabled:
        return None

    command = mcp_config.get("command", "fiftyone-mcp")
    args = mcp_config.get("args", [])

    return MCPClientManager(command=command, args=args)


def _serialize_content_blocks(content_blocks):
    """Convert Anthropic SDK content blocks to serializable dicts.

    Args:
        content_blocks: list of Anthropic content block objects

    Returns:
        list of plain dicts suitable for JSON serialization
    """
    result = []
    for block in content_blocks:
        if not hasattr(block, "type"):
            continue

        if block.type == "text":
            result.append({"type": "text", "text": block.text})
        elif block.type == "tool_use":
            result.append(
                {
                    "type": "tool_use",
                    "id": block.id,
                    "name": block.name,
                    "input": block.input,
                }
            )

    return result


def _run_streaming_loop(
    ctx,
    client,
    guardrail,
    mcp_manager,
    messages,
    system_prompt,
    tools,
    model,
    max_tokens,
    message_id,
):
    """Core streaming loop shared by SendMessage and ConfirmOperation.

    Iterates Claude's streaming API, yielding frontend triggers for each
    text delta and tool call event. Applies the guardrail layer to every
    tool call — blocking dangerous ops, pausing for confirmation on risky
    ops, and auto-executing safe ops via the MCP client.

    Args:
        ctx: the operator execution context
        client: an ``anthropic.Anthropic`` client instance
        guardrail: a :class:`GuardrailLayer` instance
        mcp_manager: a :class:`MCPClientManager`, or ``None`` if MCP is
            not configured
        messages: list of conversation messages to send to Claude
        system_prompt: the system prompt string
        tools: list of Anthropic-format tool dicts
        model: the Claude model ID string
        max_tokens: maximum tokens to generate
        message_id: the frontend message ID for this assistant turn

    Yields:
        ``ctx.trigger()`` calls sent to the frontend
    """
    max_tool_loops = 10

    for _ in range(max_tool_loops):
        try:
            with client.messages.stream(
                model=model,
                max_tokens=max_tokens,
                system=system_prompt,
                messages=messages,
                tools=tools if tools else [],
            ) as stream:
                for event in stream:
                    event_type = getattr(event, "type", None)

                    if event_type == "content_block_start":
                        cb = getattr(event, "content_block", None)
                        if cb and getattr(cb, "type", None) == "tool_use":
                            yield ctx.trigger(
                                "%s/tool_call_start" % PLUGIN_NAME,
                                {
                                    "tool_id": cb.id,
                                    "tool_name": cb.name,
                                    "message_id": message_id,
                                },
                            )

                    elif event_type == "content_block_delta":
                        delta = getattr(event, "delta", None)
                        delta_type = getattr(delta, "type", None)
                        if delta and delta_type == "text_delta":
                            yield ctx.trigger(
                                "%s/stream_chunk" % PLUGIN_NAME,
                                {
                                    "delta": delta.text,
                                    "message_id": message_id,
                                },
                            )

                final_message = stream.get_final_message()

        except Exception as e:
            logger.error("Claude API error: %s", e)
            yield ctx.trigger(
                "%s/stream_error" % PLUGIN_NAME,
                {"error": str(e), "message_id": message_id},
            )
            return

        stop_reason = getattr(final_message, "stop_reason", "end_turn")
        if stop_reason != "tool_use":
            break

        content_dicts = _serialize_content_blocks(final_message.content)
        messages.append({"role": "assistant", "content": content_dicts})

        tool_results = []
        pause_for_confirmation = False

        for block in final_message.content:
            if getattr(block, "type", None) != "tool_use":
                continue

            tool_name = block.name
            tool_input = block.input or {}
            tool_id = block.id
            decision = guardrail.check(tool_name, tool_input)

            if decision == "block":
                reason = guardrail.get_block_reason(tool_name, tool_input)
                yield ctx.trigger(
                    "%s/tool_blocked" % PLUGIN_NAME,
                    {
                        "tool_id": tool_id,
                        "tool_name": tool_name,
                        "reason": reason,
                        "message_id": message_id,
                    },
                )
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_id,
                        "content": "Blocked: %s" % reason,
                        "is_error": True,
                    }
                )

            elif decision == "confirm":
                risk = guardrail.get_risk_level(tool_name, tool_input)
                human_desc = guardrail.get_confirmation_message(
                    tool_name, tool_input
                )
                pending_id = str(uuid.uuid4())
                _pending_operations[pending_id] = {
                    "messages": messages,
                    "tool_id": tool_id,
                    "tool_name": tool_name,
                    "tool_input": tool_input,
                    "message_id": message_id,
                    "system_prompt": system_prompt,
                    "tools": tools,
                    "model": model,
                    "max_tokens": max_tokens,
                    "mcp_manager": mcp_manager,
                }
                yield ctx.trigger(
                    "%s/confirmation_required" % PLUGIN_NAME,
                    {
                        "pending_id": pending_id,
                        "tool_id": tool_id,
                        "tool_name": tool_name,
                        "tool_input": tool_input,
                        "risk": risk,
                        "human_description": human_desc,
                        "message_id": message_id,
                    },
                )
                pause_for_confirmation = True
                break  # Stop processing further tools in this batch

            else:  # allow
                if mcp_manager:
                    try:
                        tool_result = mcp_manager.call_tool(
                            tool_name, tool_input
                        )
                        preview = (
                            tool_result[:2000]
                            if len(tool_result) > 2000
                            else tool_result
                        )
                        yield ctx.trigger(
                            "%s/tool_result" % PLUGIN_NAME,
                            {
                                "tool_id": tool_id,
                                "tool_name": tool_name,
                                "result": preview,
                                "message_id": message_id,
                            },
                        )
                        tool_results.append(
                            {
                                "type": "tool_result",
                                "tool_use_id": tool_id,
                                "content": tool_result,
                            }
                        )
                    except Exception as e:
                        logger.warning("Tool %s error: %s", tool_name, e)
                        tool_results.append(
                            {
                                "type": "tool_result",
                                "tool_use_id": tool_id,
                                "content": "Error: %s" % str(e),
                                "is_error": True,
                            }
                        )
                else:
                    tool_results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": tool_id,
                            "content": (
                                "MCP server not connected. Configure an MCP "
                                "server in Settings."
                            ),
                            "is_error": True,
                        }
                    )

        if pause_for_confirmation:
            return  # Resumed later by ConfirmOperation

        if tool_results:
            messages.append({"role": "user", "content": tool_results})

    yield ctx.trigger(
        "%s/stream_complete" % PLUGIN_NAME,
        {"message_id": message_id},
    )


# ---------------------------------------------------------------------------
# Operators
# ---------------------------------------------------------------------------


class SendMessage(foo.Operator):
    """Main operator: streams a Claude response with a full tool loop.

    Builds the system prompt from active skills and FiftyOne context,
    loads MCP tools, then calls the Claude API with streaming enabled.
    Each token delta is forwarded to the frontend via ``stream_chunk``
    triggers. Tool calls are routed through the guardrail layer and
    either auto-executed, blocked, or paused for user confirmation.
    """

    @property
    def config(self):
        return foo.OperatorConfig(
            name="send_message",
            label="Send Message to Claude",
            unlisted=True,
            execute_as_generator=True,
        )

    def resolve_input(self, ctx):
        inputs = types.Object()
        inputs.str("message", label="Message", required=True)
        inputs.list("history", types.Object(), label="Chat History")
        inputs.list("active_skills", types.String(), label="Active Skills")
        inputs.obj("mcp_config", label="MCP Config")
        inputs.str("model", label="Model")
        inputs.int("max_tokens", label="Max Tokens")
        return types.Property(inputs)

    def execute(self, ctx):
        message = (ctx.params.get("message") or "").strip()
        history = ctx.params.get("history") or []
        active_skills = ctx.params.get("active_skills") or []
        mcp_config = ctx.params.get("mcp_config")
        model = ctx.params.get("model") or DEFAULT_MODEL
        max_tokens = ctx.params.get("max_tokens") or MAX_TOKENS

        if not message:
            return

        api_key = _get_api_key(ctx)
        if not api_key:
            message_id = str(uuid.uuid4())
            yield ctx.trigger(
                "%s/stream_message_start" % PLUGIN_NAME,
                {"message_id": message_id},
            )
            yield ctx.trigger(
                "%s/stream_chunk" % PLUGIN_NAME,
                {
                    "delta": (
                        "Error: No API key configured. "
                        "Set ANTHROPIC_API_KEY in your environment."
                    ),
                    "message_id": message_id,
                },
            )
            yield ctx.trigger(
                "%s/stream_complete" % PLUGIN_NAME,
                {"message_id": message_id},
            )
            return

        fo_context = _build_fo_context(ctx)
        skills_loader = SkillsLoader(skills_dir=_get_skills_dir(ctx))
        system_prompt = skills_loader.build_system_prompt(
            active_skills, fo_context
        )

        mcp_manager = _get_mcp_manager(mcp_config)
        tools = mcp_manager.list_tools() if mcp_manager else []

        messages = []
        for msg in history:
            role = msg.get("role")
            content = msg.get("content")
            if role in ("user", "assistant") and content is not None:
                messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": message})

        message_id = str(uuid.uuid4())
        yield ctx.trigger(
            "%s/stream_message_start" % PLUGIN_NAME,
            {"message_id": message_id, "role": "assistant"},
        )

        client = anthropic.Anthropic(api_key=api_key)
        guardrail = GuardrailLayer()

        yield from _run_streaming_loop(
            ctx=ctx,
            client=client,
            guardrail=guardrail,
            mcp_manager=mcp_manager,
            messages=messages,
            system_prompt=system_prompt,
            tools=tools,
            model=model,
            max_tokens=max_tokens,
            message_id=message_id,
        )


class ConfirmOperation(foo.Operator):
    """Resume streaming after the user confirms a dangerous tool operation.

    Retrieves the pending operation stored by :class:`SendMessage`, executes
    the approved tool via MCP, sends a ``tool_result`` trigger to the
    frontend, then continues the Claude conversation stream.
    """

    @property
    def config(self):
        return foo.OperatorConfig(
            name="confirm_operation",
            label="Confirm Operation",
            unlisted=True,
            execute_as_generator=True,
        )

    def resolve_input(self, ctx):
        inputs = types.Object()
        inputs.str("pending_id", label="Pending Operation ID", required=True)
        return types.Property(inputs)

    def execute(self, ctx):
        pending_id = ctx.params.get("pending_id", "")
        pending = _pending_operations.pop(pending_id, None)

        if not pending:
            logger.warning(
                "No pending operation found for id: %s", pending_id
            )
            return

        mcp_manager = pending.get("mcp_manager")
        tool_name = pending["tool_name"]
        tool_input = pending["tool_input"]
        tool_id = pending["tool_id"]
        message_id = pending["message_id"]
        messages = pending["messages"]
        system_prompt = pending["system_prompt"]
        tools = pending["tools"]
        model = pending["model"]
        max_tokens = pending["max_tokens"]

        if mcp_manager:
            try:
                tool_result = mcp_manager.call_tool(tool_name, tool_input)
            except Exception as e:
                tool_result = "Error: %s" % str(e)
        else:
            tool_result = "MCP server not connected."

        preview = (
            tool_result[:2000] if len(tool_result) > 2000 else tool_result
        )
        yield ctx.trigger(
            "%s/tool_result" % PLUGIN_NAME,
            {
                "tool_id": tool_id,
                "tool_name": tool_name,
                "result": preview,
                "message_id": message_id,
                "confirmed": True,
            },
        )

        messages.append(
            {
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_id,
                        "content": tool_result,
                    }
                ],
            }
        )

        api_key = _get_api_key(ctx)
        if not api_key:
            yield ctx.trigger(
                "%s/stream_complete" % PLUGIN_NAME,
                {"message_id": message_id},
            )
            return

        client = anthropic.Anthropic(api_key=api_key)
        guardrail = GuardrailLayer()

        yield from _run_streaming_loop(
            ctx=ctx,
            client=client,
            guardrail=guardrail,
            mcp_manager=mcp_manager,
            messages=messages,
            system_prompt=system_prompt,
            tools=tools,
            model=model,
            max_tokens=max_tokens,
            message_id=message_id,
        )


class CancelOperation(foo.Operator):
    """Cancel a pending dangerous tool operation.

    Removes the pending operation from the in-memory store and signals
    the frontend that the operation was cancelled.
    """

    @property
    def config(self):
        return foo.OperatorConfig(
            name="cancel_operation",
            label="Cancel Operation",
            unlisted=True,
        )

    def resolve_input(self, ctx):
        inputs = types.Object()
        inputs.str("pending_id", label="Pending Operation ID", required=True)
        return types.Property(inputs)

    def execute(self, ctx):
        pending_id = ctx.params.get("pending_id", "")
        pending = _pending_operations.pop(pending_id, None)
        if not pending:
            return {"cancelled": False, "error": "No pending operation found."}

        return {"cancelled": True, "message_id": pending.get("message_id", "")}


class LoadConfig(foo.Operator):
    """Load persisted plugin configuration from ctx.store on panel init.

    Returns the saved conversation history, MCP server configuration,
    active skills, and agent settings. Also returns the list of available
    skill names discovered on disk.
    """

    @property
    def config(self):
        return foo.OperatorConfig(
            name="load_config",
            label="Load Voxel Agent Config",
            unlisted=True,
        )

    def execute(self, ctx):
        try:
            store = ctx.store("claude_agent")
            history = store.get("conversation_history") or []
            mcp_servers = store.get("mcp_servers") or [
                {
                    "command": "fiftyone-mcp",
                    "args": [],
                    "enabled": True,
                    "label": "fiftyone-mcp-server",
                }
            ]
            active_skills = store.get("active_skills") or []
            settings = store.get("settings") or {
                "model": DEFAULT_MODEL,
                "max_tokens": MAX_TOKENS,
                "permission_mode": "auto",
                "persist_history": True,
            }

            skills_loader = SkillsLoader(skills_dir=_get_skills_dir(ctx))
            available_skills = list(skills_loader.load_all().keys())

            return {
                "history": history,
                "mcp_servers": mcp_servers,
                "active_skills": active_skills,
                "settings": settings,
                "available_skills": available_skills,
            }
        except Exception as e:
            logger.warning("LoadConfig error: %s", e)
            return {
                "history": [],
                "mcp_servers": [],
                "active_skills": [],
                "settings": {
                    "model": DEFAULT_MODEL,
                    "max_tokens": MAX_TOKENS,
                    "permission_mode": "auto",
                    "persist_history": True,
                },
                "available_skills": [],
            }


class SaveConfig(foo.Operator):
    """Persist plugin configuration to ctx.store.

    Saves any combination of conversation history, MCP server config,
    active skills, and agent settings. All parameters are optional.
    """

    @property
    def config(self):
        return foo.OperatorConfig(
            name="save_config",
            label="Save Voxel Agent Config",
            unlisted=True,
        )

    def resolve_input(self, ctx):
        inputs = types.Object()
        inputs.list("mcp_servers", types.Object(), label="MCP Servers")
        inputs.list("active_skills", types.String(), label="Active Skills")
        inputs.obj("settings", label="Settings")
        inputs.list("history", types.Object(), label="History")
        return types.Property(inputs)

    def execute(self, ctx):
        try:
            store = ctx.store("claude_agent")
            mcp_servers = ctx.params.get("mcp_servers")
            active_skills = ctx.params.get("active_skills")
            settings = ctx.params.get("settings")
            history = ctx.params.get("history")

            if mcp_servers is not None:
                store.set("mcp_servers", mcp_servers)
            if active_skills is not None:
                store.set("active_skills", active_skills)
            if settings is not None:
                store.set("settings", settings)
            if history is not None:
                store.set("conversation_history", history[-100:])

            return {"saved": True}
        except Exception as e:
            logger.warning("SaveConfig error: %s", e)
            return {"saved": False, "error": str(e)}


class ClearHistory(foo.Operator):
    """Reset the persisted conversation history in ctx.store."""

    @property
    def config(self):
        return foo.OperatorConfig(
            name="clear_history",
            label="Clear Voxel Agent History",
            unlisted=True,
        )

    def execute(self, ctx):
        try:
            store = ctx.store("claude_agent")
            store.set("conversation_history", [])
            return {"cleared": True}
        except Exception as e:
            logger.warning("ClearHistory error: %s", e)
            return {"cleared": False, "error": str(e)}


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


def register(plugin):
    """Register all plugin operators.

    Args:
        plugin: the :class:`fiftyone.plugins.Plugin` instance
    """
    plugin.register(SendMessage)
    plugin.register(ConfirmOperation)
    plugin.register(CancelOperation)
    plugin.register(LoadConfig)
    plugin.register(SaveConfig)
    plugin.register(ClearHistory)
