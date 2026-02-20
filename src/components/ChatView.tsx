/**
 * Scrollable list of chat messages.
 *
 * | Copyright 2017-2026, Voxel51, Inc.
 * | `voxel51.com <https://voxel51.com/>`_
 */

import React, { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { useRecoilValue } from "recoil";
import { messagesAtom, isStreamingAtom } from "../state/chatAtoms";
import { MessageBubble } from "./MessageBubble";

export const ChatView: React.FC = () => {
  const messages = useRecoilValue(messagesAtom);
  const isStreaming = useRecoilValue(isStreamingAtom);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  return (
    <Box sx={{ flex: 1, overflow: "auto" }}>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </Box>
  );
};
