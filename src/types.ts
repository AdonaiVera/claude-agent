/**
 * Shared TypeScript interfaces for the Claude Agent plugin.
 *
 * | Copyright 2017-2026, Voxel51, Inc.
 * | `voxel51.com <https://voxel51.com/>`_
 */

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
  timestamp?: number;
}

export type ToolStatus =
  | "executing"
  | "completed"
  | "blocked"
  | "awaiting_confirmation";

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: ToolStatus;
  result?: string;
  blockedReason?: string;
}

export interface PendingConfirmation {
  pendingId: string;
  toolCallId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  risk: "medium" | "high";
  humanDescription: string;
  messageId: string;
}

export interface MCPServer {
  label: string;
  command: string;
  args: string[];
  enabled: boolean;
}

export interface AgentSettings {
  model: string;
  maxTokens: number;
  permissionMode: "auto" | "confirm_all" | "block_all";
  persistHistory: boolean;
}

export interface AgentConfig {
  mcpServers: MCPServer[];
  activeSkills: string[];
  availableSkills: string[];
  settings: AgentSettings;
}

export const DEFAULT_SETTINGS: AgentSettings = {
  model: "claude-sonnet-4-20250514",
  maxTokens: 8192,
  permissionMode: "auto",
  persistHistory: true,
};

export const DEFAULT_MCP_SERVER: MCPServer = {
  label: "fiftyone-mcp-server",
  command: "fiftyone-mcp",
  args: [],
  enabled: true,
};
