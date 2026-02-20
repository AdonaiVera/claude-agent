/**
 * Recoil atoms for plugin configuration state.
 *
 * | Copyright 2017-2026, Voxel51, Inc.
 * | `voxel51.com <https://voxel51.com/>`_
 */

import { atom } from "recoil";
import type { AgentConfig } from "../types";
import { DEFAULT_SETTINGS, DEFAULT_MCP_SERVER } from "../types";

export const configAtom = atom<AgentConfig>({
  key: "claudeAgent__config",
  default: {
    mcpServers: [DEFAULT_MCP_SERVER],
    activeSkills: [],
    availableSkills: [],
    settings: DEFAULT_SETTINGS,
  },
});

export const configLoadedAtom = atom<boolean>({
  key: "claudeAgent__configLoaded",
  default: false,
});

export const activeTabAtom = atom<"chat" | "skills" | "settings">({
  key: "claudeAgent__activeTab",
  default: "chat",
});
