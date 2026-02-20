/**
 * Collapsible card displaying a tool call's name, input, status, and result.
 *
 * | Copyright 2017-2026, Voxel51, Inc.
 * | `voxel51.com <https://voxel51.com/>`_
 */

import React, { useState } from "react";
import {
  Box,
  Typography,
  Chip,
  Collapse,
  IconButton,
  CircularProgress,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import BuildIcon from "@mui/icons-material/Build";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import BlockIcon from "@mui/icons-material/Block";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import { useTheme } from "@fiftyone/components";
import type { ToolCall } from "../types";

interface ToolUseCardProps {
  toolCall: ToolCall;
}

const STATUS_CONFIG = {
  executing: {
    label: "Running",
    color: "#3B82F6",
    icon: <CircularProgress size={12} sx={{ color: "#3B82F6" }} />,
  },
  completed: {
    label: "Done",
    color: "#10B981",
    icon: <CheckCircleOutlineIcon sx={{ fontSize: 14, color: "#10B981" }} />,
  },
  blocked: {
    label: "Blocked",
    color: "#EF4444",
    icon: <BlockIcon sx={{ fontSize: 14, color: "#EF4444" }} />,
  },
  awaiting_confirmation: {
    label: "Awaiting Approval",
    color: "#F59E0B",
    icon: <HourglassEmptyIcon sx={{ fontSize: 14, color: "#F59E0B" }} />,
  },
};

export const ToolUseCard: React.FC<ToolUseCardProps> = ({ toolCall }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const statusCfg = STATUS_CONFIG[toolCall.status];

  const hasDetails =
    (toolCall.input && Object.keys(toolCall.input).length > 0) ||
    toolCall.result ||
    toolCall.blockedReason;

  return (
    <Box
      sx={{
        border: `1px solid ${theme.primary.plainBorder || "rgba(255,255,255,0.12)"}`,
        borderRadius: "8px",
        overflow: "hidden",
        my: 1,
        fontSize: "0.8rem",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 1,
          bgcolor: theme.background.level2 || "rgba(255,255,255,0.05)",
          cursor: hasDetails ? "pointer" : "default",
        }}
        onClick={() => hasDetails && setExpanded((p) => !p)}
      >
        <BuildIcon sx={{ fontSize: 14, opacity: 0.7 }} />
        <Typography
          sx={{ fontSize: "0.8rem", fontFamily: "monospace", flex: 1 }}
        >
          {toolCall.name}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {statusCfg.icon}
          <Typography sx={{ fontSize: "0.75rem", color: statusCfg.color }}>
            {statusCfg.label}
          </Typography>
        </Box>
        {hasDetails && (
          <IconButton size="small" sx={{ p: 0, ml: 0.5 }}>
            {expanded ? (
              <ExpandLessIcon sx={{ fontSize: 16 }} />
            ) : (
              <ExpandMoreIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        )}
      </Box>

      {/* Expandable body */}
      <Collapse in={expanded}>
        <Box sx={{ px: 1.5, py: 1, bgcolor: theme.background.level1 }}>
          {toolCall.input && Object.keys(toolCall.input).length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography
                sx={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  opacity: 0.6,
                  mb: 0.5,
                  textTransform: "uppercase",
                }}
              >
                Input
              </Typography>
              <Box
                component="pre"
                sx={{
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                  bgcolor: theme.background.level2,
                  p: 1,
                  borderRadius: "4px",
                  overflowX: "auto",
                  m: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {JSON.stringify(toolCall.input, null, 2)}
              </Box>
            </Box>
          )}

          {toolCall.blockedReason && (
            <Box sx={{ mb: 1 }}>
              <Typography
                sx={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "#EF4444",
                  mb: 0.5,
                }}
              >
                Blocked: {toolCall.blockedReason}
              </Typography>
            </Box>
          )}

          {toolCall.result && (
            <Box>
              <Typography
                sx={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  opacity: 0.6,
                  mb: 0.5,
                  textTransform: "uppercase",
                }}
              >
                Result
              </Typography>
              <Box
                component="pre"
                sx={{
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                  bgcolor: theme.background.level2,
                  p: 1,
                  borderRadius: "4px",
                  overflowX: "auto",
                  m: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  maxHeight: "200px",
                  overflow: "auto",
                }}
              >
                {toolCall.result}
              </Box>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};
