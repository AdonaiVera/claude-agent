/**
 * Recoil atoms for chat streaming state.
 *
 * | Copyright 2017-2026, Voxel51, Inc.
 * | `voxel51.com <https://voxel51.com/>`_
 */

import { atom } from "recoil";
import type { Message, PendingConfirmation } from "../types";

export const messagesAtom = atom<Message[]>({
  key: "claudeAgent__messages",
  default: [],
});

export const isStreamingAtom = atom<boolean>({
  key: "claudeAgent__isStreaming",
  default: false,
});

export const streamingMessageIdAtom = atom<string | null>({
  key: "claudeAgent__streamingMessageId",
  default: null,
});

export const pendingConfirmationAtom = atom<PendingConfirmation | null>({
  key: "claudeAgent__pendingConfirmation",
  default: null,
});

export const inputValueAtom = atom<string>({
  key: "claudeAgent__inputValue",
  default: "",
});
