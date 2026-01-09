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


class SendMessage(foo.Operator):
    """Operator to send a message to Claude and get a response."""

    @property
    def config(self):
        return foo.OperatorConfig(
            name="send_message",
            label="Send Message to Claude",
            unlisted=True,
        )

    def resolve_input(self, ctx):
        inputs = types.Object()
        inputs.str("message", label="Message", required=True)
        inputs.list("history", types.Object(), label="Chat History")
        return types.Property(inputs)

    def execute(self, ctx):
        """Execute the operator to send message and get response.

        Args:
            ctx: the execution context

        Returns:
            dict with response
        """
        message = ctx.params.get("message", "")
        history = ctx.params.get("history", [])

        if not message:
            return {"error": "No message provided"}

        api_key = _get_api_key(ctx)
        if not api_key:
            return {"error": "No API key configured. Set ANTHROPIC_API_KEY."}

        try:
            system_prompt = _build_system_prompt(ctx)
            response = _call_claude(api_key, history, system_prompt)
            return {"response": response}
        except Exception as e:
            logger.warning("Claude API error: %s", str(e))
            return {"error": str(e)}


def register(plugin):
    """Register plugin operators.

    Args:
        plugin: the plugin instance
    """
    plugin.register(SendMessage)
