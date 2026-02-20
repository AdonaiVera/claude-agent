/**
 * Settings panel for model configuration, skills, and MCP servers.
 *
 * | Copyright 2017-2026, Voxel51, Inc.
 * | `voxel51.com <https://voxel51.com/>`_
 */

import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  IconButton,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { useTheme } from "@fiftyone/components";
import { useRecoilState } from "recoil";
import { configAtom } from "../state/configAtoms";
import { useSaveConfig } from "../hooks/usePluginClient";
import type { MCPServer } from "../types";

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    sx={{
      fontSize: "0.7rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      opacity: 0.5,
      mb: 1.5,
      mt: 2,
    }}
  >
    {children}
  </Typography>
);

export const SettingsPanel: React.FC = () => {
  const theme = useTheme();
  const [config, setConfig] = useRecoilState(configAtom);
  const [saved, setSaved] = useState(false);
  const saveConfig = useSaveConfig();

  const updateSettings = (key: string, value: unknown) => {
    setConfig((prev) => ({
      ...prev,
      settings: { ...prev.settings, [key]: value },
    }));
  };

  const toggleSkill = (skill: string) => {
    setConfig((prev) => {
      const active = prev.activeSkills.includes(skill)
        ? prev.activeSkills.filter((s) => s !== skill)
        : [...prev.activeSkills, skill];
      return { ...prev, activeSkills: active };
    });
  };

  const toggleMcpServer = (idx: number) => {
    setConfig((prev) => ({
      ...prev,
      mcpServers: prev.mcpServers.map((s, i) =>
        i === idx ? { ...s, enabled: !s.enabled } : s
      ),
    }));
  };

  const removeMcpServer = (idx: number) => {
    setConfig((prev) => ({
      ...prev,
      mcpServers: prev.mcpServers.filter((_, i) => i !== idx),
    }));
  };

  const addMcpServer = () => {
    const newServer: MCPServer = {
      label: "New MCP Server",
      command: "python",
      args: [],
      enabled: false,
    };
    setConfig((prev) => ({
      ...prev,
      mcpServers: [...prev.mcpServers, newServer],
    }));
  };

  const handleSave = async () => {
    await saveConfig({
      mcpServers: config.mcpServers,
      activeSkills: config.activeSkills,
      settings: config.settings,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>

      {/* Model Settings */}
      <SectionTitle>Model</SectionTitle>
      <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
        <InputLabel>Model</InputLabel>
        <Select
          value={config.settings.model}
          label="Model"
          onChange={(e) => updateSettings("model", e.target.value)}
        >
          <MenuItem value="claude-sonnet-4-20250514">Claude Sonnet 4</MenuItem>
          <MenuItem value="claude-opus-4-5">Claude Opus 4.5</MenuItem>
          <MenuItem value="claude-haiku-4-5-20251001">Claude Haiku 4.5</MenuItem>
        </Select>
      </FormControl>
      <TextField
        fullWidth
        size="small"
        label="Max Tokens"
        type="number"
        value={config.settings.maxTokens}
        onChange={(e) =>
          updateSettings("maxTokens", parseInt(e.target.value, 10) || 8192)
        }
        sx={{ mb: 1.5 }}
        inputProps={{ min: 256, max: 32000, step: 256 }}
      />

      {/* Permission Mode */}
      <SectionTitle>Permission Mode</SectionTitle>
      <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
        <InputLabel>Mode</InputLabel>
        <Select
          value={config.settings.permissionMode}
          label="Mode"
          onChange={(e) => updateSettings("permissionMode", e.target.value)}
        >
          <MenuItem value="auto">Auto (confirm dangerous ops)</MenuItem>
          <MenuItem value="confirm_all">Confirm all tool calls</MenuItem>
          <MenuItem value="block_all">Block all tool calls</MenuItem>
        </Select>
      </FormControl>

      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={config.settings.persistHistory}
            onChange={(e) =>
              updateSettings("persistHistory", e.target.checked)
            }
          />
        }
        label={
          <Typography sx={{ fontSize: "0.875rem" }}>
            Persist conversation history
          </Typography>
        }
        sx={{ mb: 1 }}
      />

      <Divider sx={{ my: 2, opacity: 0.2 }} />

      {/* Skills */}
      <SectionTitle>Active Skills</SectionTitle>
      {config.availableSkills.length === 0 ? (
        <Typography sx={{ fontSize: "0.8rem", opacity: 0.5, mb: 1.5 }}>
          No skills found. Place skill directories in{" "}
          <Box component="code" sx={{ fontSize: "0.75rem" }}>
            ~/.fiftyone/skills/
          </Box>{" "}
          or set the{" "}
          <Box component="code" sx={{ fontSize: "0.75rem" }}>
            FIFTYONE_SKILLS_DIR
          </Box>{" "}
          secret.
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
          {config.availableSkills.map((skill) => {
            const isActive = config.activeSkills.includes(skill);
            return (
              <Chip
                key={skill}
                icon={<AutoAwesomeIcon sx={{ fontSize: 12 }} />}
                label={skill.replace("fiftyone-", "").replace(/-/g, " ")}
                onClick={() => toggleSkill(skill)}
                variant={isActive ? "filled" : "outlined"}
                size="small"
                sx={{
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  bgcolor: isActive ? "#D9770620" : "transparent",
                  borderColor: isActive ? "#D97706" : "rgba(255,255,255,0.2)",
                  color: isActive ? "#D97706" : undefined,
                }}
              />
            );
          })}
        </Box>
      )}

      <Divider sx={{ my: 2, opacity: 0.2 }} />

      {/* MCP Servers */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
        <SectionTitle>MCP Servers</SectionTitle>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Add MCP server">
          <IconButton size="small" onClick={addMcpServer}>
            <AddIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {config.mcpServers.map((server, idx) => (
        <Box
          key={idx}
          sx={{
            border: `1px solid ${server.enabled ? "#D97706" : "rgba(255,255,255,0.1)"}`,
            borderRadius: "8px",
            p: 1.5,
            mb: 1,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1,
            }}
          >
            <Typography sx={{ fontSize: "0.85rem", fontWeight: 600 }}>
              {server.label || "MCP Server"}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Switch
                size="small"
                checked={server.enabled}
                onChange={() => toggleMcpServer(idx)}
              />
              <Tooltip title="Remove">
                <IconButton
                  size="small"
                  onClick={() => removeMcpServer(idx)}
                  sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
                >
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <Typography
            sx={{ fontSize: "0.75rem", fontFamily: "monospace", opacity: 0.6 }}
          >
            {server.command} {server.args.join(" ")}
          </Typography>
        </Box>
      ))}

      {/* Save button */}
      <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          onClick={handleSave}
          sx={{
            bgcolor: saved ? "#10B981" : "#D97706",
            "&:hover": { bgcolor: saved ? "#059669" : "#B45309" },
            transition: "background-color 0.2s",
          }}
        >
          {saved ? "Saved!" : "Save Settings"}
        </Button>
      </Box>
    </Box>
  );
};
