# Voxel Agent

<div align="center">
<p align="center">

<!-- prettier-ignore -->
<img src="https://user-images.githubusercontent.com/25985824/106288517-2422e000-6216-11eb-871d-26ad2e7b1e59.png" height="55px"> &nbsp;
<img src="https://user-images.githubusercontent.com/25985824/106288518-24bb7680-6216-11eb-8f10-60052c519586.png" height="50px">

</p>

**A production-grade AI agent panel for FiftyOne**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![FiftyOne](https://img.shields.io/badge/FiftyOne-v1.0+-orange.svg)](https://github.com/voxel51/fiftyone)
[![MCP Server](https://img.shields.io/badge/MCP%20Server-fiftyone--mcp-green.svg)](https://github.com/voxel51/fiftyone-mcp-server)
[![Discord](https://img.shields.io/badge/Discord-FiftyOne%20Community-7289DA.svg)](https://discord.gg/fiftyone-community)

[Documentation](https://docs.voxel51.com) · [MCP Server](https://github.com/voxel51/fiftyone-mcp-server) · [FiftyOne Skills](https://github.com/voxel51/fiftyone-skills) · [Discord](https://discord.gg/fiftyone-community)

</div>

## Overview

Voxel Agent brings Claude AI directly into FiftyOne as a panel. Ask questions about your datasets, run operators, and automate workflows — all in natural language.

```
"List all my datasets and summarize the current one"
"Find duplicate images and show me the results"
"Visualize embeddings for the selected samples"
```

The agent connects to the [FiftyOne MCP Server](https://github.com/voxel51/fiftyone-mcp-server) (80+ operators), loads [FiftyOne Skills](https://github.com/voxel51/fiftyone-skills) for complex workflows, and applies guardrails so destructive operations always require confirmation.

## Installation

```bash
fiftyone plugins download https://github.com/AdonaiVera/claude-agent
fiftyone plugins requirements @adonaivera/claude-agent --install
```

## Setup

**1. Set your Anthropic API key**

```python
import fiftyone as fo

fo.config.plugins["@adonaivera/claude-agent"] = {
    "ANTHROPIC_API_KEY": "sk-ant-..."
}
fo.config.save()
```

Or export it before starting FiftyOne:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

**2. Install Skills (optional)**

```bash
pip install fiftyone-mcp-server
```

Skills are loaded automatically from `~/.fiftyone/skills/` — cloned from [voxel51/fiftyone-skills](https://github.com/voxel51/fiftyone-skills) on first use.

## Features

| Feature | Description |
|---------|-------------|
| **Streaming** | Responses stream token by token |
| **Tool use** | Calls FiftyOne MCP tools automatically |
| **Guardrails** | Read ops run instantly; write ops show a confirmation dialog |
| **Skills** | Injects skill instructions into the system prompt |
| **History** | Conversation persists across sessions via `ctx.store()` |
| **Settings** | Configure model, MCP servers, and active skills from the panel |

## Guardrail Levels

| Level | Examples | Behavior |
|-------|----------|----------|
| **Allow** | `list_datasets`, `dataset_summary`, `load_dataset` | Executes immediately |
| **Confirm** | `delete`, `clear`, `merge`, `overwrite` operators | Shows confirmation modal |
| **Block** | `execute_shell`, `drop_database`, `raw_mongodb` | Rejected with explanation |

## Resources

| Resource | Description |
|----------|-------------|
| [FiftyOne Docs](https://docs.voxel51.com) | Official documentation |
| [FiftyOne MCP Server](https://github.com/voxel51/fiftyone-mcp-server) | MCP server for AI integration |
| [FiftyOne Skills](https://github.com/voxel51/fiftyone-skills) | Packaged workflows for AI assistants |
| [FiftyOne Plugins](https://github.com/voxel51/fiftyone-plugins) | Official plugin collection |
| [Discord Community](https://discord.gg/fiftyone-community) | Get help and share ideas |

---

<div align="center">

Copyright 2017-2026, Voxel51, Inc. · [Apache 2.0 License](LICENSE)

</div>
