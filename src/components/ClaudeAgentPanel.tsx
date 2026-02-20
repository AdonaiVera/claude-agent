/**
 * Root Voxel Agent panel with Chat, Skills, and Settings tabs.
 *
 * | Copyright 2017-2026, Voxel51, Inc.
 * | `voxel51.com <https://voxel51.com/>`_
 */

import React, { useEffect } from "react";
import { Box, Typography, Tabs, Tab } from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import ChatIcon from "@mui/icons-material/Chat";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SettingsIcon from "@mui/icons-material/Settings";
import { useTheme } from "@fiftyone/components";
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import { messagesAtom, isStreamingAtom } from "../state/chatAtoms";
import { configAtom, configLoadedAtom, activeTabAtom } from "../state/configAtoms";
import { ChatView } from "./ChatView";
import { EmptyState } from "./EmptyState";
import { InputBar } from "./InputBar";
import { SettingsPanel } from "./SettingsPanel";
import { ConfirmationModal } from "./ConfirmationModal";
import { useSendMessage, useLoadConfig, useSaveConfig } from "../hooks/usePluginClient";

export const ClaudeAgentPanel: React.FC = () => {
  const theme = useTheme();
  const messages = useRecoilValue(messagesAtom);
  const isStreaming = useRecoilValue(isStreamingAtom);
  const [config, setConfig] = useRecoilState(configAtom);
  const [configLoaded, setConfigLoaded] = useRecoilState(configLoadedAtom);
  const [activeTab, setActiveTab] = useRecoilState(activeTabAtom);
  const setMessages = useSetRecoilState(messagesAtom);
  const sendMessage = useSendMessage();
  const loadConfig = useLoadConfig();
  const saveConfig = useSaveConfig();

  useEffect(() => {
    if (!configLoaded) {
      loadConfig().then((result: any) => {
        if (result) {
          setConfig((prev) => ({
            ...prev,
            mcpServers: result.mcp_servers || prev.mcpServers,
            activeSkills: result.active_skills || prev.activeSkills,
            availableSkills: result.available_skills || prev.availableSkills,
            settings: {
              ...prev.settings,
              ...(result.settings || {}),
            },
          }));
          if (result.history && result.history.length > 0) {
            setMessages(
              result.history.map((msg: any, idx: number) => ({
                id: `history-${idx}`,
                role: msg.role as "user" | "assistant",
                content: typeof msg.content === "string" ? msg.content : "",
                timestamp: Date.now() - (result.history.length - idx) * 1000,
              }))
            );
          }
        }
        setConfigLoaded(true);
      }).catch(() => setConfigLoaded(true));
    }
  }, []);

  const handleSend = async (message: string) => {
    const userMsgId = `user-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user" as const,
        content: message,
        timestamp: Date.now(),
      },
    ]);

    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const enabledServer = config.mcpServers.find((s) => s.enabled);
    const mcpConfig = enabledServer
      ? {
          command: enabledServer.command,
          args: enabledServer.args,
          enabled: true,
        }
      : undefined;

    await sendMessage({
      message,
      history,
      activeSkills: config.activeSkills,
      mcpConfig,
      model: config.settings.model,
      maxTokens: config.settings.maxTokens,
    });

    if (config.settings.persistHistory) {
      const allMessages = [
        ...messages,
        { role: "user" as const, content: message },
      ];
      await saveConfig({ history: allMessages });
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bgcolor: theme.background?.body || "#141414",
        position: "relative",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 1,
          borderBottom: `1px solid ${theme.primary?.plainBorder || "rgba(255,255,255,0.08)"}`,
          bgcolor: theme.background?.header || "#1a1a1a",
          flexShrink: 0,
        }}
      >
        <SmartToyIcon sx={{ color: "#D97706", fontSize: 20 }} />
        <Typography sx={{ fontWeight: 700, fontSize: "0.875rem" }}>
          Voxel Agent
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            minHeight: "unset",
            "& .MuiTabs-indicator": { bgcolor: "#D97706" },
          }}
        >
          <Tab
            value="chat"
            icon={<ChatIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label="Chat"
            sx={{
              minHeight: "unset",
              py: 0.5,
              px: 1.5,
              fontSize: "0.75rem",
              fontWeight: 600,
              minWidth: "unset",
              textTransform: "none",
              "&.Mui-selected": { color: "#D97706" },
            }}
          />
          <Tab
            value="skills"
            icon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label="Skills"
            sx={{
              minHeight: "unset",
              py: 0.5,
              px: 1.5,
              fontSize: "0.75rem",
              fontWeight: 600,
              minWidth: "unset",
              textTransform: "none",
              "&.Mui-selected": { color: "#D97706" },
            }}
          />
          <Tab
            value="settings"
            icon={<SettingsIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label="Settings"
            sx={{
              minHeight: "unset",
              py: 0.5,
              px: 1.5,
              fontSize: "0.75rem",
              fontWeight: 600,
              minWidth: "unset",
              textTransform: "none",
              "&.Mui-selected": { color: "#D97706" },
            }}
          />
        </Tabs>
      </Box>

      {/* Content */}
      {activeTab === "chat" && (
        <>
          {messages.length === 0 ? (
            <EmptyState onPromptClick={(p) => {
              setActiveTab("chat");
              handleSend(p);
            }} />
          ) : (
            <ChatView />
          )}
          <InputBar onSend={handleSend} />
        </>
      )}

      {activeTab === "skills" && (
        <SkillsTab
          availableSkills={config.availableSkills}
          activeSkills={config.activeSkills}
          onToggle={(skill) =>
            setConfig((prev) => ({
              ...prev,
              activeSkills: prev.activeSkills.includes(skill)
                ? prev.activeSkills.filter((s) => s !== skill)
                : [...prev.activeSkills, skill],
            }))
          }
        />
      )}

      {activeTab === "settings" && <SettingsPanel />}

      {/* Confirmation modal (absolute overlay) */}
      <ConfirmationModal />
    </Box>
  );
};

const SkillsTab: React.FC<{
  availableSkills: string[];
  activeSkills: string[];
  onToggle: (skill: string) => void;
}> = ({ availableSkills, activeSkills, onToggle }) => {
  const theme = useTheme();

  if (availableSkills.length === 0) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 3,
          textAlign: "center",
        }}
      >
        <Box>
          <AutoAwesomeIcon sx={{ fontSize: 40, opacity: 0.3, mb: 2 }} />
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, mb: 1 }}>
            No Skills Found
          </Typography>
          <Typography sx={{ fontSize: "0.8rem", opacity: 0.5 }}>
            Add skill directories to{" "}
            <Box component="code" sx={{ fontSize: "0.75rem" }}>
              ~/.fiftyone/skills/
            </Box>{" "}
            or set the{" "}
            <Box component="code" sx={{ fontSize: "0.75rem" }}>
              FIFTYONE_SKILLS_DIR
            </Box>{" "}
            secret.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
      <Typography sx={{ fontSize: "0.8rem", opacity: 0.6, mb: 2, lineHeight: 1.5 }}>
        Toggle skills to inject their instructions into Claude's system prompt.
        Active skills appear below the message input.
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {availableSkills.map((skill) => {
          const isActive = activeSkills.includes(skill);
          return (
            <Box
              key={skill}
              onClick={() => onToggle(skill)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                p: 1.5,
                border: `1px solid ${isActive ? "#D97706" : "rgba(255,255,255,0.1)"}`,
                borderRadius: "8px",
                cursor: "pointer",
                bgcolor: isActive
                  ? "#D9770610"
                  : theme.background?.level1 || "rgba(255,255,255,0.03)",
                transition: "all 0.15s ease",
                "&:hover": {
                  borderColor: "#D97706",
                  bgcolor: "#D9770618",
                },
              }}
            >
              <AutoAwesomeIcon
                sx={{ fontSize: 18, color: isActive ? "#D97706" : undefined, opacity: isActive ? 1 : 0.4 }}
              />
              <Box>
                <Typography sx={{ fontSize: "0.875rem", fontWeight: 600 }}>
                  {skill.replace("fiftyone-", "").replace(/-/g, " ")}
                </Typography>
                <Typography sx={{ fontSize: "0.75rem", opacity: 0.5 }}>
                  {skill}
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }} />
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: isActive ? "#D97706" : "rgba(255,255,255,0.15)",
                  flexShrink: 0,
                }}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
