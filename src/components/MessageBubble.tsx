/**
 * Single chat message with markdown rendering and inline tool call cards.
 *
 * | Copyright 2017-2026, Voxel51, Inc.
 * | `voxel51.com <https://voxel51.com/>`_
 */

import React from "react";
import { Box, Typography, Avatar } from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import { useTheme } from "@fiftyone/components";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ToolUseCard } from "./ToolUseCard";
import type { Message } from "../types";

interface MessageBubbleProps {
  message: Message;
}

const MarkdownComponents = {
  p: ({ children }: any) => (
    <Typography
      component="p"
      sx={{ fontSize: "0.875rem", lineHeight: 1.7, mb: 1, mt: 0 }}
    >
      {children}
    </Typography>
  ),
  code: ({ inline, children, className }: any) => {
    if (inline) {
      return (
        <Box
          component="code"
          sx={{
            fontFamily: "monospace",
            fontSize: "0.8rem",
            bgcolor: "rgba(255,255,255,0.08)",
            px: 0.5,
            py: 0.25,
            borderRadius: "3px",
          }}
        >
          {children}
        </Box>
      );
    }
    return (
      <Box
        component="pre"
        sx={{
          fontFamily: "monospace",
          fontSize: "0.8rem",
          bgcolor: "rgba(0,0,0,0.3)",
          p: 1.5,
          borderRadius: "6px",
          overflowX: "auto",
          my: 1,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        <code className={className}>{children}</code>
      </Box>
    );
  },
  h1: ({ children }: any) => (
    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, mt: 1.5 }}>
      {children}
    </Typography>
  ),
  h2: ({ children }: any) => (
    <Typography
      sx={{ fontWeight: 700, fontSize: "1rem", mb: 1, mt: 1.5 }}
    >
      {children}
    </Typography>
  ),
  h3: ({ children }: any) => (
    <Typography
      sx={{ fontWeight: 600, fontSize: "0.9rem", mb: 0.75, mt: 1 }}
    >
      {children}
    </Typography>
  ),
  ul: ({ children }: any) => (
    <Box component="ul" sx={{ pl: 2.5, mb: 1, mt: 0 }}>
      {children}
    </Box>
  ),
  ol: ({ children }: any) => (
    <Box component="ol" sx={{ pl: 2.5, mb: 1, mt: 0 }}>
      {children}
    </Box>
  ),
  li: ({ children }: any) => (
    <Typography
      component="li"
      sx={{ fontSize: "0.875rem", lineHeight: 1.6, mb: 0.25 }}
    >
      {children}
    </Typography>
  ),
  blockquote: ({ children }: any) => (
    <Box
      sx={{
        borderLeft: "3px solid rgba(255,255,255,0.2)",
        pl: 1.5,
        my: 1,
        opacity: 0.8,
      }}
    >
      {children}
    </Box>
  ),
  strong: ({ children }: any) => (
    <Box component="strong" sx={{ fontWeight: 700 }}>
      {children}
    </Box>
  ),
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const theme = useTheme();
  const isUser = message.role === "user";

  return (
    <Box
      sx={{
        display: "flex",
        gap: 1.5,
        px: 2,
        py: 1.5,
        bgcolor: isUser
          ? theme.background.level1
          : theme.background.header,
        alignItems: "flex-start",
      }}
    >
      <Avatar
        sx={{
          width: 28,
          height: 28,
          bgcolor: isUser ? theme.primary?.main || "#6366f1" : "#D97706",
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {isUser ? (
          <PersonIcon sx={{ fontSize: 16 }} />
        ) : (
          <SmartToyIcon sx={{ fontSize: 16 }} />
        )}
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{ fontWeight: 600, fontSize: "0.8rem", mb: 0.5, opacity: 0.7 }}
        >
          {isUser ? "You" : "Claude"}
        </Typography>

        {isUser ? (
          <Typography sx={{ fontSize: "0.875rem", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {message.content}
          </Typography>
        ) : (
          <>
            {message.content && (
              <Box sx={{ "& > *:last-child": { mb: 0 } }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={MarkdownComponents}
                >
                  {message.content}
                </ReactMarkdown>
              </Box>
            )}
            {message.isStreaming && !message.content && (
              <Box
                sx={{
                  display: "inline-flex",
                  gap: "3px",
                  alignItems: "center",
                  mt: 0.5,
                }}
              >
                {[0, 1, 2].map((i) => (
                  <Box
                    key={i}
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      bgcolor: "#D97706",
                      animation: "pulse 1.2s ease-in-out infinite",
                      animationDelay: `${i * 0.2}s`,
                      "@keyframes pulse": {
                        "0%, 80%, 100%": { opacity: 0.2 },
                        "40%": { opacity: 1 },
                      },
                    }}
                  />
                ))}
              </Box>
            )}
            {(message.toolCalls || []).map((tc) => (
              <ToolUseCard key={tc.id} toolCall={tc} />
            ))}
          </>
        )}
      </Box>
    </Box>
  );
};
