/**
 * Full-screen confirmation modal for dangerous tool operations.
 *
 * | Copyright 2017-2026, Voxel51, Inc.
 * | `voxel51.com <https://voxel51.com/>`_
 */

import React from "react";
import {
  Box,
  Typography,
  Button,
  Chip,
  Backdrop,
  Paper,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { useTheme } from "@fiftyone/components";
import { useRecoilState, useSetRecoilState } from "recoil";
import { pendingConfirmationAtom, messagesAtom } from "../state/chatAtoms";
import { useConfirmOperation, useCancelOperation } from "../hooks/usePluginClient";

export const ConfirmationModal: React.FC = () => {
  const theme = useTheme();
  const [pending, setPending] = useRecoilState(pendingConfirmationAtom);
  const setMessages = useSetRecoilState(messagesAtom);
  const confirmOp = useConfirmOperation();
  const cancelOp = useCancelOperation();

  if (!pending) return null;

  const isHigh = pending.risk === "high";

  const handleConfirm = async () => {
    setPending(null);
    // Update tool call status to executing
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== pending.messageId) return m;
        return {
          ...m,
          toolCalls: (m.toolCalls || []).map((tc) =>
            tc.id === pending.toolCallId
              ? { ...tc, status: "executing" as const }
              : tc
          ),
        };
      })
    );
    await confirmOp(pending.pendingId);
  };

  const handleCancel = async () => {
    // Update tool call status to blocked
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== pending.messageId) return m;
        return {
          ...m,
          toolCalls: (m.toolCalls || []).map((tc) =>
            tc.id === pending.toolCallId
              ? {
                  ...tc,
                  status: "blocked" as const,
                  blockedReason: "Cancelled by user.",
                }
              : tc
          ),
        };
      })
    );
    setPending(null);
    await cancelOp(pending.pendingId);
  };

  return (
    <Backdrop
      open={true}
      sx={{ zIndex: 9999, bgcolor: "rgba(0,0,0,0.7)" }}
    >
      <Paper
        elevation={8}
        sx={{
          bgcolor: theme.background.header || "#1a1a1a",
          border: `1px solid ${isHigh ? "#EF4444" : "#F59E0B"}`,
          borderRadius: "12px",
          p: 3,
          maxWidth: 480,
          width: "90%",
        }}
      >
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
          {isHigh ? (
            <ErrorOutlineIcon sx={{ fontSize: 28, color: "#EF4444" }} />
          ) : (
            <WarningAmberIcon sx={{ fontSize: 28, color: "#F59E0B" }} />
          )}
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: "1rem" }}>
              Confirm Operation
            </Typography>
            <Chip
              label={isHigh ? "HIGH RISK" : "MEDIUM RISK"}
              size="small"
              sx={{
                bgcolor: isHigh ? "#EF444420" : "#F59E0B20",
                color: isHigh ? "#EF4444" : "#F59E0B",
                border: `1px solid ${isHigh ? "#EF4444" : "#F59E0B"}`,
                fontSize: "0.65rem",
                height: "18px",
                fontWeight: 700,
              }}
            />
          </Box>
        </Box>

        {/* Description */}
        <Typography
          sx={{ fontSize: "0.875rem", mb: 2, lineHeight: 1.6, opacity: 0.9 }}
        >
          {pending.humanDescription}
        </Typography>

        {/* Tool details */}
        <Box
          sx={{
            bgcolor: theme.background.level1 || "rgba(0,0,0,0.3)",
            borderRadius: "8px",
            p: 1.5,
            mb: 2.5,
          }}
        >
          <Typography
            sx={{
              fontSize: "0.7rem",
              fontWeight: 600,
              opacity: 0.5,
              mb: 0.5,
              textTransform: "uppercase",
            }}
          >
            Tool
          </Typography>
          <Typography
            sx={{ fontSize: "0.875rem", fontFamily: "monospace", mb: 1 }}
          >
            {pending.toolName}
          </Typography>
          {Object.keys(pending.toolInput).length > 0 && (
            <>
              <Typography
                sx={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  opacity: 0.5,
                  mb: 0.5,
                  textTransform: "uppercase",
                }}
              >
                Parameters
              </Typography>
              <Box
                component="pre"
                sx={{
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                  bgcolor: theme.background.level2,
                  p: 1,
                  borderRadius: "4px",
                  m: 0,
                  maxHeight: "120px",
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {JSON.stringify(pending.toolInput, null, 2)}
              </Box>
            </>
          )}
        </Box>

        {/* Action buttons */}
        <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
          <Button
            variant="outlined"
            onClick={handleCancel}
            sx={{
              borderColor: "rgba(255,255,255,0.2)",
              color: "rgba(255,255,255,0.7)",
              "&:hover": { borderColor: "rgba(255,255,255,0.4)" },
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirm}
            sx={{
              bgcolor: isHigh ? "#EF4444" : "#F59E0B",
              color: "#fff",
              fontWeight: 600,
              "&:hover": {
                bgcolor: isHigh ? "#DC2626" : "#D97706",
              },
            }}
          >
            Confirm
          </Button>
        </Box>
      </Paper>
    </Backdrop>
  );
};
