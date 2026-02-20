/**
 * TypeScript operators that handle streaming events triggered from Python.
 *
 * Each operator updates Recoil state to drive the chat UI. Operators are
 * invoked by Python via ``ctx.trigger("@adonaivera/claude-agent/<name>", params)``.
 *
 * | Copyright 2017-2026, Voxel51, Inc.
 * | `voxel51.com <https://voxel51.com/>`_
 */

import { Operator, OperatorConfig } from "@fiftyone/operators";
import { useSetRecoilState } from "recoil";
import {
  messagesAtom,
  isStreamingAtom,
  streamingMessageIdAtom,
  pendingConfirmationAtom,
} from "./state/chatAtoms";
import type { Message, ToolCall, PendingConfirmation } from "./types";

// ---------------------------------------------------------------------------
// stream_message_start — create a new (empty) assistant message
// ---------------------------------------------------------------------------

export class StreamMessageStart extends Operator {
  get config(): OperatorConfig {
    return new OperatorConfig({ name: "stream_message_start", unlisted: true });
  }

  useHooks() {
    return {
      setMessages: useSetRecoilState(messagesAtom),
      setStreamingId: useSetRecoilState(streamingMessageIdAtom),
      setStreaming: useSetRecoilState(isStreamingAtom),
    };
  }

  async execute(ctx: { params: Record<string, string>; hooks: ReturnType<typeof this.useHooks> }) {
    const { setMessages, setStreamingId, setStreaming } = ctx.hooks;
    const { message_id } = ctx.params;

    const newMsg: Message = {
      id: message_id,
      role: "assistant",
      content: "",
      toolCalls: [],
      isStreaming: true,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newMsg]);
    setStreamingId(message_id);
    setStreaming(true);
  }
}

// ---------------------------------------------------------------------------
// stream_chunk — append a text delta to the active message
// ---------------------------------------------------------------------------

export class StreamChunk extends Operator {
  get config(): OperatorConfig {
    return new OperatorConfig({ name: "stream_chunk", unlisted: true });
  }

  useHooks() {
    return { setMessages: useSetRecoilState(messagesAtom) };
  }

  async execute(ctx: { params: Record<string, string>; hooks: ReturnType<typeof this.useHooks> }) {
    const { setMessages } = ctx.hooks;
    const { delta, message_id } = ctx.params;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === message_id ? { ...m, content: m.content + delta } : m
      )
    );
  }
}

// ---------------------------------------------------------------------------
// stream_complete — finalize the streaming message
// ---------------------------------------------------------------------------

export class StreamComplete extends Operator {
  get config(): OperatorConfig {
    return new OperatorConfig({ name: "stream_complete", unlisted: true });
  }

  useHooks() {
    return {
      setMessages: useSetRecoilState(messagesAtom),
      setStreamingId: useSetRecoilState(streamingMessageIdAtom),
      setStreaming: useSetRecoilState(isStreamingAtom),
    };
  }

  async execute(ctx: { params: Record<string, string>; hooks: ReturnType<typeof this.useHooks> }) {
    const { setMessages, setStreamingId, setStreaming } = ctx.hooks;
    const { message_id } = ctx.params;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === message_id ? { ...m, isStreaming: false } : m
      )
    );
    setStreamingId(null);
    setStreaming(false);
  }
}

// ---------------------------------------------------------------------------
// stream_error — append an error notice and stop streaming
// ---------------------------------------------------------------------------

export class StreamError extends Operator {
  get config(): OperatorConfig {
    return new OperatorConfig({ name: "stream_error", unlisted: true });
  }

  useHooks() {
    return {
      setMessages: useSetRecoilState(messagesAtom),
      setStreaming: useSetRecoilState(isStreamingAtom),
      setStreamingId: useSetRecoilState(streamingMessageIdAtom),
    };
  }

  async execute(ctx: { params: Record<string, string>; hooks: ReturnType<typeof this.useHooks> }) {
    const { setMessages, setStreaming, setStreamingId } = ctx.hooks;
    const { error, message_id } = ctx.params;

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== message_id) return m;
        const separator = m.content ? "\n\n" : "";
        return {
          ...m,
          content: `${m.content}${separator}⚠️ Error: ${error}`,
          isStreaming: false,
        };
      })
    );
    setStreaming(false);
    setStreamingId(null);
  }
}

// ---------------------------------------------------------------------------
// tool_call_start — add a new executing tool call card
// ---------------------------------------------------------------------------

export class ToolCallStart extends Operator {
  get config(): OperatorConfig {
    return new OperatorConfig({ name: "tool_call_start", unlisted: true });
  }

  useHooks() {
    return { setMessages: useSetRecoilState(messagesAtom) };
  }

  async execute(ctx: { params: Record<string, string>; hooks: ReturnType<typeof this.useHooks> }) {
    const { setMessages } = ctx.hooks;
    const { tool_id, tool_name, message_id } = ctx.params;

    const newToolCall: ToolCall = {
      id: tool_id,
      name: tool_name,
      input: {},
      status: "executing",
    };

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== message_id) return m;
        return { ...m, toolCalls: [...(m.toolCalls || []), newToolCall] };
      })
    );
  }
}

// ---------------------------------------------------------------------------
// tool_result — mark a tool call as completed with its result
// ---------------------------------------------------------------------------

export class ToolResult extends Operator {
  get config(): OperatorConfig {
    return new OperatorConfig({ name: "tool_result", unlisted: true });
  }

  useHooks() {
    return { setMessages: useSetRecoilState(messagesAtom) };
  }

  async execute(ctx: { params: Record<string, string>; hooks: ReturnType<typeof this.useHooks> }) {
    const { setMessages } = ctx.hooks;
    const { tool_id, result, message_id } = ctx.params;

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== message_id) return m;
        return {
          ...m,
          toolCalls: (m.toolCalls || []).map((tc) =>
            tc.id === tool_id
              ? { ...tc, status: "completed" as const, result }
              : tc
          ),
        };
      })
    );
  }
}

// ---------------------------------------------------------------------------
// tool_blocked — mark a tool call as blocked with a reason
// ---------------------------------------------------------------------------

export class ToolBlocked extends Operator {
  get config(): OperatorConfig {
    return new OperatorConfig({ name: "tool_blocked", unlisted: true });
  }

  useHooks() {
    return { setMessages: useSetRecoilState(messagesAtom) };
  }

  async execute(ctx: { params: Record<string, string>; hooks: ReturnType<typeof this.useHooks> }) {
    const { setMessages } = ctx.hooks;
    const { tool_id, reason, message_id } = ctx.params;

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== message_id) return m;
        return {
          ...m,
          toolCalls: (m.toolCalls || []).map((tc) =>
            tc.id === tool_id
              ? { ...tc, status: "blocked" as const, blockedReason: reason }
              : tc
          ),
        };
      })
    );
  }
}

// ---------------------------------------------------------------------------
// confirmation_required — pause streaming and show the confirmation modal
// ---------------------------------------------------------------------------

export class ConfirmationRequired extends Operator {
  get config(): OperatorConfig {
    return new OperatorConfig({
      name: "confirmation_required",
      unlisted: true,
    });
  }

  useHooks() {
    return {
      setMessages: useSetRecoilState(messagesAtom),
      setPendingConfirmation: useSetRecoilState(pendingConfirmationAtom),
    };
  }

  async execute(ctx: { params: Record<string, unknown>; hooks: ReturnType<typeof this.useHooks> }) {
    const { setMessages, setPendingConfirmation } = ctx.hooks;
    const {
      pending_id,
      tool_id,
      tool_name,
      tool_input,
      risk,
      human_description,
      message_id,
    } = ctx.params as Record<string, string>;

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== message_id) return m;

        const hasCall = (m.toolCalls || []).some((tc) => tc.id === tool_id);
        const toolCalls = hasCall
          ? (m.toolCalls || []).map((tc) =>
              tc.id === tool_id
                ? {
                    ...tc,
                    status: "awaiting_confirmation" as const,
                    input: (tool_input as unknown as Record<string, unknown>) || {},
                  }
                : tc
            )
          : [
              ...(m.toolCalls || []),
              {
                id: tool_id,
                name: tool_name,
                input: (tool_input as unknown as Record<string, unknown>) || {},
                status: "awaiting_confirmation" as const,
              },
            ];

        return { ...m, toolCalls };
      })
    );

    const confirmation: PendingConfirmation = {
      pendingId: pending_id,
      toolCallId: tool_id,
      toolName: tool_name,
      toolInput: (tool_input as unknown as Record<string, unknown>) || {},
      risk: risk as "medium" | "high",
      humanDescription: human_description,
      messageId: message_id,
    };
    setPendingConfirmation(confirmation);
  }
}

export const ALL_OPERATORS = [
  StreamMessageStart,
  StreamChunk,
  StreamComplete,
  StreamError,
  ToolCallStart,
  ToolResult,
  ToolBlocked,
  ConfirmationRequired,
];
