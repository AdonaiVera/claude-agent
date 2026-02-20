/**
 * Hooks wrapping FiftyOne operator executors for the Claude Agent backend.
 *
 * | Copyright 2017-2026, Voxel51, Inc.
 * | `voxel51.com <https://voxel51.com/>`_
 */

import { useCallback } from "react";
import { useOperatorExecutor } from "@fiftyone/operators";
import type { MCPServer, AgentSettings } from "../types";

const PLUGIN = "@adonaivera/claude-agent";

interface SendMessageParams {
  message: string;
  history: Array<{ role: string; content: unknown }>;
  activeSkills: string[];
  mcpConfig?: Partial<MCPServer>;
  model?: string;
  maxTokens?: number;
}

export function useSendMessage() {
  const executor = useOperatorExecutor(`${PLUGIN}/send_message`);
  return useCallback(
    (params: SendMessageParams) => executor.execute(params),
    [executor]
  );
}

export function useConfirmOperation() {
  const executor = useOperatorExecutor(`${PLUGIN}/confirm_operation`);
  return useCallback(
    (pendingId: string) => executor.execute({ pending_id: pendingId }),
    [executor]
  );
}

export function useCancelOperation() {
  const executor = useOperatorExecutor(`${PLUGIN}/cancel_operation`);
  return useCallback(
    (pendingId: string) => executor.execute({ pending_id: pendingId }),
    [executor]
  );
}

export function useLoadConfig() {
  const executor = useOperatorExecutor(`${PLUGIN}/load_config`);
  return useCallback(() => executor.execute({}), [executor]);
}

export function useSaveConfig() {
  const executor = useOperatorExecutor(`${PLUGIN}/save_config`);
  return useCallback(
    (params: {
      mcpServers?: MCPServer[];
      activeSkills?: string[];
      settings?: Partial<AgentSettings>;
      history?: unknown[];
    }) => executor.execute(params),
    [executor]
  );
}

export function useClearHistory() {
  const executor = useOperatorExecutor(`${PLUGIN}/clear_history`);
  return useCallback(() => executor.execute({}), [executor]);
}
