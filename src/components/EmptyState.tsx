/**
 * Welcome screen shown when the conversation history is empty.
 *
 * | Copyright 2017-2026, Voxel51, Inc.
 * | `voxel51.com <https://voxel51.com/>`_
 */

import React from "react";
import { Box, Typography, Avatar, Chip } from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { useTheme } from "@fiftyone/components";
import { useRecoilValue } from "recoil";
import { configAtom } from "../state/configAtoms";

const DEFAULT_PROMPTS = [
  { label: "List my datasets", prompt: "List all my FiftyOne datasets." },
  {
    label: "Dataset summary",
    prompt: "Give me a summary of the current dataset.",
  },
  {
    label: "Find duplicates",
    prompt:
      "Use the fiftyone-find-duplicates skill to find duplicate images in the current dataset.",
  },
  {
    label: "Visualize embeddings",
    prompt:
      "Use the fiftyone-embeddings-visualization skill to visualize the current dataset in 2D.",
  },
];

interface EmptyStateProps {
  onPromptClick: (prompt: string) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onPromptClick }) => {
  const theme = useTheme();
  const config = useRecoilValue(configAtom);

  // Build skill-based chips from active skills
  const skillChips = config.activeSkills.slice(0, 4).map((skill) => ({
    label: skill.replace("fiftyone-", "").replace(/-/g, " "),
    prompt: `Use the ${skill} skill.`,
  }));

  const chips = skillChips.length > 0 ? skillChips : DEFAULT_PROMPTS;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        p: 3,
        textAlign: "center",
      }}
    >
      <Avatar
        sx={{ width: 56, height: 56, bgcolor: "#D97706", mb: 2 }}
      >
        <SmartToyIcon sx={{ fontSize: 32 }} />
      </Avatar>
      <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 700 }}>
        Voxel Agent
      </Typography>
      <Typography
        variant="body2"
        sx={{ maxWidth: 380, mb: 3, opacity: 0.65, lineHeight: 1.6 }}
      >
        Ask questions about your datasets, run models, explore data, or use
        skills to automate complex FiftyOne workflows.
      </Typography>
      <Typography
        variant="caption"
        sx={{ mb: 1.5, opacity: 0.5, textTransform: "uppercase", letterSpacing: 1 }}
      >
        Try asking
      </Typography>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          justifyContent: "center",
          maxWidth: 440,
        }}
      >
        {chips.map((chip, idx) => (
          <Chip
            key={idx}
            icon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
            label={chip.label}
            onClick={() => onPromptClick(chip.prompt)}
            sx={{
              cursor: "pointer",
              bgcolor: theme.background?.level1 || "rgba(255,255,255,0.05)",
              border: `1px solid ${theme.primary?.plainBorder || "rgba(255,255,255,0.12)"}`,
              fontSize: "0.8rem",
              "&:hover": {
                bgcolor: theme.background?.level2 || "rgba(255,255,255,0.1)",
                borderColor: "#D97706",
              },
              transition: "all 0.15s ease",
            }}
          />
        ))}
      </Box>
    </Box>
  );
};
