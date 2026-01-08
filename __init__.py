"""
Claude Agent panel for FiftyOne.

| Copyright 2017-2025, Voxel51, Inc.
| `voxel51.com <https://voxel51.com/>`_
|
"""

import logging
import os

import fiftyone.operators as foo
import fiftyone.operators.types as types
import fiftyone.core.utils as fou
from fiftyone.operators.panel import Panel, PanelConfig

anthropic = fou.lazy_import("anthropic")

logger = logging.getLogger(__name__)

PLUGIN_NAME = "@adonaivera/claude-agent"
DEFAULT_MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 1024


def _get_api_key(ctx):
    """Get Anthropic API key from secrets or environment.

    Args:
        ctx: the execution context

    Returns:
        the API key string, or None if not found
    """
    api_key = ctx.secrets.get("ANTHROPIC_API_KEY")
    if not api_key:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
    return api_key


def _build_system_prompt(ctx):
    """Build system prompt with dataset context.

    Args:
        ctx: the execution context

    Returns:
        the system prompt string
    """
    prompt = (
        "You are a helpful assistant for FiftyOne, a tool for building "
        "high-quality datasets and computer vision models."
    )

    if ctx.dataset:
        prompt += f"\n\nDataset: '{ctx.dataset.name}' with {len(ctx.dataset)} samples."
        prompt += f"\nMedia type: {ctx.dataset.media_type}"
        fields = list(ctx.dataset.get_field_schema().keys())
        prompt += f"\nFields: {', '.join(fields)}"

    return prompt


def _call_claude(api_key, messages, system_prompt):
    """Call Claude API with messages.

    Args:
        api_key: the Anthropic API key
        messages: list of message dicts with role and content
        system_prompt: the system prompt string

    Returns:
        the assistant response text

    Raises:
        Exception: if API call fails
    """
    client = anthropic.Anthropic(api_key=api_key)

    api_messages = [
        {"role": m["role"], "content": m["content"]}
        for m in messages
    ]

    response = client.messages.create(
        model=DEFAULT_MODEL,
        max_tokens=MAX_TOKENS,
        system=system_prompt,
        messages=api_messages,
    )

    return response.content[0].text


class ClaudeAgentPanel(Panel):
    """Claude Agent chat panel for interacting with datasets."""

    @property
    def config(self):
        return PanelConfig(
            name="claude_agent",
            label="Claude Agent",
            icon="smart_toy",
            allow_multiple=False,
            surfaces="grid modal",
        )

    def on_load(self, ctx):
        """Initialize panel state on load."""
        ctx.panel.set_state("messages", [])
        api_key = _get_api_key(ctx)
        ctx.panel.set_state("api_key_configured", bool(api_key))

    def render(self, ctx):
        """Render the panel UI.

        Args:
            ctx: the execution context

        Returns:
            a Property containing the panel layout
        """
        panel = types.Object()
        api_key_configured = ctx.panel.get_state("api_key_configured", False)

        if api_key_configured:
            self._render_chat(ctx, panel)
        else:
            self._render_setup(panel)

        return types.Property(panel)

    def _render_setup(self, panel):
        """Render API key setup view."""
        panel.view(
            "header",
            types.Header(
                label="Claude Agent Setup",
                description="Enter your Anthropic API key to start chatting",
                divider=True,
            ),
        )
        panel.str(
            "api_key_input",
            label="Anthropic API Key",
            view=types.View(placeholder="sk-ant-..."),
        )
        panel.view(
            "save_btn",
            types.Button(
                label="Save API Key",
                operator=f"{PLUGIN_NAME}/save_api_key",
            ),
        )

    def _render_chat(self, ctx, panel):
        """Render chat interface."""
        messages = ctx.panel.get_state("messages", [])

        panel.view(
            "header",
            types.Header(
                label="Claude Agent",
                description="Ask me anything about your dataset",
                divider=True,
            ),
        )

        if messages:
            for i, msg in enumerate(messages):
                role = msg.get("role", "user")
                content = msg.get("content", "")
                prefix = "You" if role == "user" else "Claude"
                panel.md(f"**{prefix}:** {content}", name=f"msg_{i}")
        else:
            panel.view(
                "empty",
                types.Notice(label="Start a conversation by typing a message below"),
            )

        panel.str(
            "user_input",
            label="Message",
            view=types.View(placeholder="Ask about your dataset..."),
        )
        panel.view(
            "send_btn",
            types.Button(
                label="Send",
                operator=f"{PLUGIN_NAME}/send_message",
            ),
        )


class SaveApiKey(foo.Operator):
    """Operator to save Anthropic API key to environment."""

    @property
    def config(self):
        return foo.OperatorConfig(
            name="save_api_key",
            label="Save API Key",
            unlisted=True,
        )

    def resolve_input(self, ctx):
        inputs = types.Object()
        return types.Property(inputs)

    def execute(self, ctx):
        """Execute the operator to save API key.

        Args:
            ctx: the execution context
        """
        api_key = ctx.panel.get_state("api_key_input", "")

        if not api_key or not api_key.startswith("sk-"):
            logger.warning("Invalid API key format")
            ctx.panel.set_state("api_key_input", "")
            return

        os.environ["ANTHROPIC_API_KEY"] = api_key
        ctx.panel.set_state("api_key_configured", True)
        ctx.panel.set_state("api_key_input", "")


class SendMessage(foo.Operator):
    """Operator to send a message to Claude."""

    @property
    def config(self):
        return foo.OperatorConfig(
            name="send_message",
            label="Send Message to Claude",
            unlisted=True,
        )

    def resolve_input(self, ctx):
        inputs = types.Object()
        return types.Property(inputs)

    def execute(self, ctx):
        """Execute the operator to send message and get response.

        Args:
            ctx: the execution context
        """
        message = ctx.panel.get_state("user_input", "")
        if not message:
            return

        api_key = _get_api_key(ctx)
        if not api_key:
            logger.warning("No API key configured")
            return

        messages = ctx.panel.get_state("messages", [])
        messages.append({"role": "user", "content": message})
        ctx.panel.set_state("messages", messages)
        ctx.panel.set_state("user_input", "")

        try:
            system_prompt = _build_system_prompt(ctx)
            response = _call_claude(api_key, messages, system_prompt)
            messages.append({"role": "assistant", "content": response})
            ctx.panel.set_state("messages", messages)
        except Exception as e:
            logger.warning("Claude API error: %s", str(e))
            messages.append({"role": "assistant", "content": f"Error: {str(e)}"})
            ctx.panel.set_state("messages", messages)


def register(plugin):
    """Register plugin operators.

    Args:
        plugin: the plugin instance
    """
    plugin.register(ClaudeAgentPanel)
    plugin.register(SaveApiKey)
    plugin.register(SendMessage)
