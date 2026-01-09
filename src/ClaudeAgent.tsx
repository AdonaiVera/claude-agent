import { PluginComponentType, registerComponent } from "@fiftyone/plugins";
import { usePanelStatePartial } from "@fiftyone/spaces";
import React, { useEffect, useRef } from "react";
import { useOperatorExecutor } from "@fiftyone/operators";
import { useTheme } from "@fiftyone/components";
import {
  Grid,
  Box,
  Typography,
  Avatar,
  OutlinedInput,
  IconButton,
  CircularProgress,
  Chip,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

const PLUGIN_NAME = "@adonaivera/claude-agent";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Skill {
  label: string;
  prompt: string;
}

const SKILLS: Skill[] = [
  {
    label: "Dataset Import",
    prompt: "Using the fiftyone-dataset-import skill, import the image dataset at ~/my-data/images as my_dataset and open the FiftyOne App.",
  },
  {
    label: "Find Duplicates",
    prompt: "Using the fiftyone-find-duplicates skill, find and remove duplicate images from my quickstart dataset.",
  },
  {
    label: "Dataset Inference",
    prompt: "Using the fiftyone-dataset-inference skill, import the image dataset at ~/my-data/images as my_dataset, run YOLOv8, and open the FiftyOne App.",
  },
  {
    label: "Visualize Embeddings",
    prompt: "Using the fiftyone-embeddings-visualization skill, visualize my quickstart dataset in 2D, show clusters, and color by ground_truth label.",
  },
];

const SkillChip = ({
  skill,
  onClick,
}: {
  skill: Skill;
  onClick: (prompt: string) => void;
}) => {
  const theme = useTheme();

  return (
    <Chip
      icon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
      label={skill.label}
      onClick={() => onClick(skill.prompt)}
      sx={{
        cursor: "pointer",
        bgcolor: theme.background.level1,
        border: `1px solid ${theme.primary.plainBorder}`,
        "&:hover": {
          bgcolor: theme.background.level2,
          borderColor: theme.primary.main,
        },
        transition: "all 0.2s ease",
      }}
    />
  );
};

const MessageBubble = ({
  message,
  isUser,
}: {
  message: Message;
  isUser: boolean;
}) => {
  const theme = useTheme();

  return (
    <Grid
      container
      sx={{
        padding: "1rem",
        background: isUser ? theme.background.level1 : theme.background.header,
      }}
      justifyContent="center"
    >
      <Grid container item xs={10} spacing={2} sx={{ minWidth: "400px" }}>
        <Grid item>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: isUser ? theme.primary.main : "#D97706",
            }}
          >
            {isUser ? <PersonIcon /> : <SmartToyIcon />}
          </Avatar>
        </Grid>
        <Grid item xs>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: "0.875rem",
              mb: 0.5,
            }}
          >
            {isUser ? "You" : "Claude"}
          </Typography>
          <Typography
            sx={{
              whiteSpace: "pre-wrap",
              fontSize: "0.875rem",
              lineHeight: 1.6,
            }}
          >
            {message.content}
          </Typography>
        </Grid>
      </Grid>
    </Grid>
  );
};

const LoadingIndicator = () => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      gap: 1,
      padding: "0.5rem 1rem",
      opacity: 0.7,
    }}
  >
    <CircularProgress size={16} />
    <Typography variant="body2">Claude is thinking...</Typography>
  </Box>
);

const Chat = ({
  messages,
  isLoading,
}: {
  messages: Message[];
  isLoading: boolean;
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <Box sx={{ overflow: "auto", flex: 1 }}>
      {messages.map((msg, idx) => (
        <MessageBubble key={idx} message={msg} isUser={msg.role === "user"} />
      ))}
      {isLoading && (
        <Grid
          container
          sx={{ padding: "1rem" }}
          justifyContent="center"
        >
          <Grid item xs={10}>
            <LoadingIndicator />
          </Grid>
        </Grid>
      )}
      <div ref={bottomRef} />
    </Box>
  );
};

const InputBar = ({
  disabled,
  onSend,
  value,
  onChange,
}: {
  disabled: boolean;
  onSend: (msg: string) => void;
  value: string;
  onChange: (val: string) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (value.trim() && !disabled) {
      onSend(value.trim());
      onChange("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  return (
    <Box sx={{ padding: "1rem" }}>
      <OutlinedInput
        inputRef={inputRef}
        fullWidth
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Ask Claude about your dataset..."
        endAdornment={
          <IconButton
            disabled={!value.trim() || disabled}
            onClick={handleSend}
          >
            <SendIcon sx={{ opacity: value.trim() && !disabled ? 1 : 0.3 }} />
          </IconButton>
        }
      />
    </Box>
  );
};

const EmptyState = ({ onSkillClick }: { onSkillClick: (prompt: string) => void }) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <Avatar
        sx={{
          width: 64,
          height: 64,
          bgcolor: "#D97706",
          mb: 2,
        }}
      >
        <SmartToyIcon sx={{ fontSize: 36 }} />
      </Avatar>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Claude Agent
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mb: 3 }}>
        Ask questions about your dataset, get help with FiftyOne operations, or
        explore your data with AI assistance.
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5 }}>
        Try one of these:
      </Typography>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          justifyContent: "center",
          maxWidth: 500,
        }}
      >
        {SKILLS.map((skill, idx) => (
          <SkillChip key={idx} skill={skill} onClick={onSkillClick} />
        ))}
      </Box>
    </Box>
  );
};

const ClaudeAgentPanel = () => {
  const [panelState, setPanelState] = usePanelStatePartial(
    "claudeAgentState",
    { messages: [], isLoading: false }
  );
  const [inputValue, setInputValue] = React.useState("");
  const executor = useOperatorExecutor(`${PLUGIN_NAME}/send_message`);

  const messages = panelState?.messages || [];
  const isLoading = panelState?.isLoading || false;

  const handleSend = async (message: string) => {
    const newMessages = [...messages, { role: "user" as const, content: message }];
    setPanelState({ messages: newMessages, isLoading: true });

    try {
      const result = await executor.execute({ message, history: newMessages });
      if (result?.response) {
        setPanelState({
          messages: [...newMessages, { role: "assistant" as const, content: result.response }],
          isLoading: false,
        });
      }
    } catch (error) {
      setPanelState({
        messages: [
          ...newMessages,
          { role: "assistant" as const, content: `Error: ${error}` },
        ],
        isLoading: false,
      });
    }
  };

  const handleSkillClick = (prompt: string) => {
    setInputValue(prompt);
  };

  return (
    <Grid
      container
      direction="column"
      sx={{ height: "100%", flexWrap: "nowrap" }}
    >
      {messages.length === 0 ? (
        <EmptyState onSkillClick={handleSkillClick} />
      ) : (
        <Chat messages={messages} isLoading={isLoading} />
      )}
      <InputBar
        disabled={isLoading}
        onSend={handleSend}
        value={inputValue}
        onChange={setInputValue}
      />
    </Grid>
  );
};

registerComponent({
  name: "claude_agent",
  label: "Claude Agent",
  component: ClaudeAgentPanel,
  type: PluginComponentType.Panel,
  activator: () => true,
  Icon: () => <SmartToyIcon style={{ marginRight: "0.5rem" }} />,
});
