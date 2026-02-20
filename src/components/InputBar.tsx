/**
 * Multiline message input bar with streaming stop button.
 *
 * | Copyright 2017-2026, Voxel51, Inc.
 * | `voxel51.com <https://voxel51.com/>`_
 */

import React, { useRef, useEffect } from "react";
import { Box, OutlinedInput, IconButton, Tooltip } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import StopIcon from "@mui/icons-material/Stop";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useTheme } from "@fiftyone/components";
import { useRecoilState, useRecoilValue } from "recoil";
import { isStreamingAtom, inputValueAtom, messagesAtom } from "../state/chatAtoms";
import { useClearHistory } from "../hooks/usePluginClient";

interface InputBarProps {
  onSend: (message: string) => void;
}

export const InputBar: React.FC<InputBarProps> = ({ onSend }) => {
  const theme = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useRecoilState(inputValueAtom);
  const isStreaming = useRecoilValue(isStreamingAtom);
  const messages = useRecoilValue(messagesAtom);
  const clearHistory = useClearHistory();

  const handleSend = () => {
    const val = inputValue.trim();
    if (!val || isStreaming) return;
    setInputValue("");
    onSend(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (!isStreaming) {
      inputRef.current?.focus();
    }
  }, [isStreaming]);

  const handleClear = async () => {
    await clearHistory();
  };

  return (
    <Box
      sx={{
        borderTop: `1px solid ${theme.primary?.plainBorder || "rgba(255,255,255,0.08)"}`,
        p: 1.5,
        display: "flex",
        gap: 1,
        alignItems: "flex-end",
      }}
    >
      {messages.length > 0 && (
        <Tooltip title="Clear history">
          <IconButton size="small" onClick={handleClear} sx={{ mb: 0.25, opacity: 0.5, "&:hover": { opacity: 1 } }}>
            <DeleteOutlineIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      )}
      <OutlinedInput
        inputRef={inputRef}
        fullWidth
        multiline
        maxRows={6}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isStreaming}
        placeholder="Ask Claude about your data..."
        sx={{
          fontSize: "0.875rem",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor:
              theme.primary?.plainBorder || "rgba(255,255,255,0.15)",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: theme.primary?.main || "#6366f1",
          },
        }}
        endAdornment={
          <Tooltip title={isStreaming ? "Stop" : "Send (Enter)"}>
            <span>
              <IconButton
                disabled={!inputValue.trim() && !isStreaming}
                onClick={isStreaming ? undefined : handleSend}
                sx={{ p: 0.5 }}
              >
                {isStreaming ? (
                  <StopIcon sx={{ fontSize: 20, color: "#EF4444" }} />
                ) : (
                  <SendIcon
                    sx={{
                      fontSize: 20,
                      opacity: inputValue.trim() ? 1 : 0.3,
                      color: inputValue.trim()
                        ? theme.primary?.main || "#6366f1"
                        : undefined,
                    }}
                  />
                )}
              </IconButton>
            </span>
          </Tooltip>
        }
      />
    </Box>
  );
};
