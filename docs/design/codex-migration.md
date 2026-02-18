# oh-my-codex: Migration Design Document

**From**: oh-my-opencodex v3.7.1 (OpenCode Plugin)
**To**: oh-my-codex (Codex SDK Wrapper + MCP Server)
**Date**: 2026-02-18
**Status**: Draft

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Module Structure](#2-module-structure)
3. [SDK Wrapper Design](#3-sdk-wrapper-design)
4. [MCP Server Design](#4-mcp-server-design)
5. [Config System](#5-config-system)
6. [Agent Prompts Adaptation](#6-agent-prompts-adaptation)
7. [Feature Parity Matrix](#7-feature-parity-matrix)
8. [Migration Plan](#8-migration-plan)
9. [Package & Branding](#9-package--branding)

---

## 1. Architecture Overview

### 1.1 Current Architecture (oh-my-opencodex)

oh-my-opencodex is an OpenCode plugin that hooks into OpenCode's lifecycle via
`@opencode-ai/plugin`. It exports a single `Plugin` function that returns 8
hook handlers. All tools, agents, and features operate within OpenCode's process.

```
┌─────────────────────────────────────────────────────┐
│                    OpenCode Process                  │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │           oh-my-opencodex Plugin               │  │
│  │                                               │  │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────────┐   │  │
│  │  │ 26 Tools │ │ 41 Hooks │ │ 11 Agents    │   │  │
│  │  └─────────┘ └──────────┘ └──────────────┘   │  │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────────┐   │  │
│  │  │ 3 MCPs  │ │ Config   │ │ Background   │   │  │
│  │  │ (remote)│ │ (Zod)    │ │ Manager      │   │  │
│  │  └─────────┘ └──────────┘ └──────────────┘   │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  @opencode-ai/plugin  ←→  @opencode-ai/sdk          │
└─────────────────────────────────────────────────────┘
```

### 1.2 Target Architecture (oh-my-codex)

oh-my-codex is a standalone CLI that wraps the Codex SDK and runs an MCP server
to expose custom tools. It is NOT a plugin — it owns the entire process.

```
┌────────────────────────────────────────────────────────────────────┐
│                     oh-my-codex Process                            │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                        CLI Layer                              │  │
│  │   oh-my-codex [prompt]  |  oh-my-codex exec  |  doctor       │  │
│  └──────────────────┬───────────────────────────────────────────┘  │
│                     │                                              │
│  ┌──────────────────▼───────────────────────────────────────────┐  │
│  │                   Orchestrator                                │  │
│  │                                                               │  │
│  │  ┌─────────────────┐   ┌──────────────────────────────────┐  │  │
│  │  │  Codex SDK       │   │  MCP Server (stdio)              │  │  │
│  │  │  Wrapper         │   │                                  │  │  │
│  │  │                 │   │  ┌────────┐ ┌─────────────────┐  │  │  │
│  │  │  Thread mgmt    │   │  │ Tools  │ │ Resources       │  │  │  │
│  │  │  Event stream   │   │  │ (22)   │ │ (context, rules)│  │  │  │
│  │  │  Turn control   │   │  └────────┘ └─────────────────┘  │  │  │
│  │  │  Multi-thread   │   │  ┌────────┐                      │  │  │
│  │  │  (background)   │   │  │Prompts │                      │  │  │
│  │  │                 │   │  │(agents)│                      │  │  │
│  │  └────────┬────────┘   │  └────────┘                      │  │  │
│  │           │            └──────────────┬───────────────────┘  │  │
│  │           │                           │                      │  │
│  │  ┌────────▼───────────────────────────▼──────────────────┐  │  │
│  │  │              Event Processor                           │  │  │
│  │  │                                                        │  │  │
│  │  │  ┌─────────────┐ ┌────────────────┐ ┌──────────────┐  │  │  │
│  │  │  │ Turn Hooks   │ │ Item Watchers  │ │ Continuation │  │  │  │
│  │  │  │ (lifecycle)  │ │ (file_change,  │ │ Engine       │  │  │  │
│  │  │  │              │ │  todo_list,    │ │ (boulder,    │  │  │  │
│  │  │  │              │ │  mcp_tool_call)│ │  ralph-loop) │  │  │  │
│  │  │  └─────────────┘ └────────────────┘ └──────────────┘  │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                                                               │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐   │  │
│  │  │ Config Manager │  │ Instructions   │  │ Session      │   │  │
│  │  │ (TOML + JSONC) │  │ Generator      │  │ Store        │   │  │
│  │  │                │  │ (AGENTS.md +   │  │              │   │  │
│  │  │                │  │  rules)        │  │              │   │  │
│  │  └────────────────┘  └────────────────┘  └──────────────┘   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  @openai/codex-sdk  ←→  @modelcontextprotocol/sdk                  │
└────────────────────────────────────────────────────────────────────┘
         │                         │
         ▼                         ▼
  ┌──────────────┐         ┌──────────────────┐
  │ codex binary │         │ External MCPs    │
  │ (child proc) │         │ (websearch, c7,  │
  │              │         │  grep_app)       │
  └──────────────┘         └──────────────────┘
```

### 1.3 Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **SDK Wrapper, not fork** | Codex SDK spawns `codex exec` as child process. We wrap `Codex`/`Thread` classes to intercept events, inject instructions, and control turn flow. |
| **MCP Server for tools** | Codex natively consumes MCP servers via `config.toml`. Our 22 reusable tools become an MCP server that Codex calls. |
| **TOML + JSONC config** | Generate `~/.codex/config.toml` for Codex-native settings; keep JSONC for oh-my-codex-specific settings. |
| **Event-driven hooks** | Replace OpenCode's 8 hook handlers with event listeners on the JSONL stream from `codex exec`. |
| **OpenAI-only models** | Codex uses OpenAI models exclusively. Multi-provider fallback chains collapse to OpenAI model tiers. |
| **Process-level parallelism** | Background agents = multiple `Thread` instances within the same `Codex` SDK process. Each thread is independent. |
| **Instructions via AGENTS.md + developer_instructions** | Agent system prompts become generated `AGENTS.md` content + `developer_instructions` in config.toml instead of OpenCode `AgentConfig.instructions`. Note: `.codex/rules/` uses Starlark `.rules` files for command approval policies only, NOT for agent behavioral instructions. |

### 1.4 Dependency Changes

| Current (oh-my-opencodex) | New (oh-my-codex) | Notes |
|---------------------------|-------------------|-------|
| `@opencode-ai/plugin` | REMOVED | No longer a plugin |
| `@opencode-ai/sdk` | REMOVED | No OpenCode SDK |
| `@modelcontextprotocol/sdk` | KEPT | MCP server implementation |
| `zod` | KEPT | Config validation |
| `commander` | KEPT | CLI framework |
| `@ast-grep/napi` | KEPT | AST search (MCP tool) |
| `vscode-jsonrpc` | KEPT | LSP tools (MCP tool) |
| — | `@openai/codex-sdk` | NEW: Core SDK |
| — | `@iarna/toml` | NEW: TOML generation |

---

## 2. Module Structure

### 2.1 New Directory Layout

```
oh-my-codex/
├── src/
│   ├── index.ts                    # CLI entry point
│   ├── orchestrator/               # Core orchestration
│   │   ├── orchestrator.ts         # Main: config → codex → mcp → event-loop
│   │   ├── codex-wrapper.ts        # Codex SDK wrapper (Thread lifecycle)
│   │   ├── thread-pool.ts          # Multi-thread management (background agents)
│   │   ├── event-loop.ts           # JSONL event stream processor
│   │   └── types.ts                # Orchestrator types
│   │
│   ├── mcp-server/                 # MCP Server (stdio)
│   │   ├── server.ts               # McpServer setup + transport
│   │   ├── tool-registry.ts        # Register 22 tools
│   │   ├── resource-registry.ts    # Register resources (context, rules)
│   │   ├── prompt-registry.ts      # Register prompts (agent templates)
│   │   └── types.ts
│   │
│   ├── tools/                      # 22 MCP tools (reused from oh-my-opencodex)
│   │   ├── ast-grep/               # AST search/replace
│   │   ├── background-task/        # Background thread management
│   │   ├── call-agent/             # Agent invocation (via thread-pool)
│   │   ├── delegate-task/          # Category-based delegation
│   │   ├── glob/                   # File pattern matching
│   │   ├── grep/                   # Content search
│   │   ├── interactive-bash/       # Tmux integration
│   │   ├── look-at/                # Multimodal analysis
│   │   ├── lsp/                    # LSP refactoring (6 tools)
│   │   ├── session-manager/        # Session history (4 tools)
│   │   ├── skill/                  # Skill loader
│   │   ├── skill-mcp/              # Skill MCP bridge
│   │   └── slashcommand/           # Slash commands
│   │
│   ├── event-hooks/                # Event-driven hook system
│   │   ├── hook-registry.ts        # Hook registration + dispatch
│   │   ├── turn-hooks/             # Turn lifecycle hooks
│   │   │   ├── turn-started.ts
│   │   │   ├── turn-completed.ts
│   │   │   └── turn-failed.ts
│   │   ├── item-hooks/             # Item-level hooks
│   │   │   ├── file-change-checker.ts   # Comment checker on file_change
│   │   │   ├── todo-list-watcher.ts     # Todo continuation enforcer
│   │   │   ├── command-watcher.ts       # Command execution monitoring
│   │   │   └── mcp-tool-watcher.ts      # MCP tool call monitoring
│   │   ├── continuation/           # Continuation engine
│   │   │   ├── boulder.ts          # Todo enforcement (boulder state)
│   │   │   ├── ralph-loop.ts       # Iterative refinement loop
│   │   │   └── stop-guard.ts       # Stop continuation guard
│   │   └── session/                # Session-level hooks
│   │       ├── session-recovery.ts
│   │       ├── usage-monitor.ts
│   │       └── notification.ts
│   │
│   ├── instructions/               # Instruction generation
│   │   ├── agents-md-generator.ts  # Generate AGENTS.md content
│   │   ├── rules-generator.ts      # Generate .codex/rules/ files (Starlark)
│   │   ├── agent-prompts/          # Agent prompt templates
│   │   │   ├── sisyphus.ts         # Main orchestrator prompt
│   │   │   ├── hephaestus.ts       # Autonomous worker prompt
│   │   │   ├── oracle.ts           # Consultant prompt
│   │   │   ├── librarian.ts        # Research prompt
│   │   │   ├── explore.ts          # Codebase search prompt
│   │   │   └── atlas.ts            # Todo orchestrator prompt
│   │   └── dynamic-prompt-builder.ts
│   │
│   ├── config/                     # Configuration system
│   │   ├── config-loader.ts        # JSONC config loading
│   │   ├── codex-config-writer.ts  # Generate config.toml for Codex
│   │   ├── schema/                 # Zod v4 schemas (adapted)
│   │   │   ├── oh-my-codex-config.ts
│   │   │   ├── agent-overrides.ts
│   │   │   ├── categories.ts
│   │   │   ├── hooks.ts
│   │   │   ├── background-task.ts
│   │   │   ├── comment-checker.ts
│   │   │   ├── ralph-loop.ts
│   │   │   └── experimental.ts
│   │   └── migration.ts            # Migrate oh-my-opencodex config
│   │
│   ├── features/                   # Feature modules
│   │   ├── background-agent/       # Multi-thread background execution
│   │   ├── boulder-state/          # Boulder persistence
│   │   ├── builtin-skills/         # Built-in skills
│   │   ├── builtin-commands/       # Built-in commands
│   │   ├── context-injector/       # Context injection via MCP resources
│   │   ├── skill-mcp-manager/      # Skill-embedded MCP management
│   │   ├── session-store/          # Session persistence
│   │   └── tmux-subagent/          # Tmux layout management
│   │
│   ├── cli/                        # CLI commands
│   │   ├── cli-program.ts          # Commander.js program
│   │   ├── install.ts              # Setup wizard
│   │   ├── run.ts                  # Non-interactive execution
│   │   ├── doctor.ts               # Health diagnostics
│   │   └── start.ts                # Interactive session
│   │
│   └── shared/                     # Shared utilities (slimmed)
│       ├── logger.ts
│       ├── deep-merge.ts
│       ├── jsonc-parser.ts
│       ├── toml-writer.ts
│       ├── file-utils.ts
│       ├── command-executor.ts
│       └── config-errors.ts
│
├── package.json
├── tsconfig.json
└── bin/
    └── oh-my-codex.js
```

### 2.2 What's Removed vs Kept vs Adapted

| Current Directory | Disposition | Notes |
|-------------------|-------------|-------|
| `src/plugin/` (21 files) | **REMOVED** | Replaced by orchestrator + event-hooks |
| `src/plugin-interface.ts` | **REMOVED** | No longer a plugin |
| `src/plugin-config.ts` | **ADAPTED** -> `config/config-loader.ts` | Same JSONC loading, different output |
| `src/plugin-handlers/` (18 files) | **REMOVED** | Config handler -> codex-config-writer |
| `src/plugin-state.ts` | **ADAPTED** -> session state in orchestrator |
| `src/tools/` (17 dirs) | **ADAPTED** -> `tools/` + `mcp-server/` | Tools become MCP tool handlers |
| `src/hooks/` (53 dirs) | **ADAPTED** -> `event-hooks/` | Hooks become event listeners |
| `src/agents/` (26 files) | **ADAPTED** -> `instructions/agent-prompts/` | Prompts become AGENTS.md content |
| `src/features/` (20 dirs) | **PARTIALLY KEPT** | 12 of 20 modules survive |
| `src/mcp/` (8 files) | **REMOVED** | MCPs configured directly in config.toml |
| `src/cli/` (118 files) | **ADAPTED** -> `cli/` | Simplified CLI |
| `src/shared/` (104 files) | **SLIMMED** -> `shared/` | Remove OpenCode-specific utilities |
| `src/config/` (22 files) | **ADAPTED** -> `config/schema/` | Reduced schema set |

### 2.3 LOC Estimates

| Current | Estimated New | Reduction |
|---------|---------------|-----------|
| ~130k LOC | ~35-45k LOC | ~65-70% reduction |

The massive reduction comes from:
- Removing OpenCode plugin layer (~8k LOC)
- Removing Claude Code compatibility (~5k LOC)
- Removing multi-provider model resolution (~5k LOC)
- Removing OpenCode-specific utilities (~15k LOC)
- Removing redundant hook infrastructure (~10k LOC)
- Simplifying agent system (~4k LOC from 11->6 agents)

---

## 3. SDK Wrapper Design

### 3.1 Core Wrapper: CodexWrapper

The wrapper manages the lifecycle of a `Codex` instance and its threads,
providing event interception and instruction injection.

```typescript
// src/orchestrator/codex-wrapper.ts

import { Codex, type ThreadOptions } from "@openai/codex-sdk"
import type { OhMyCodexConfig } from "../config/schema/oh-my-codex-config"

export type CodexWrapperOptions = {
  config: OhMyCodexConfig
  workingDirectory: string
  agentName: string
  instructions: string            // Generated AGENTS.md content
  mcpServerCommand: string[]      // Command to start our MCP server
  externalMcpServers: Record<string, { command: string; args: string[] }>
}

export class CodexWrapper {
  private codex: Codex
  private primaryThread: Thread | null = null
  private config: OhMyCodexConfig

  constructor(options: CodexWrapperOptions) {
    this.config = options.config

    // IMPORTANT: env replaces process.env entirely in Codex SDK
    // Must include all needed environment variables
    this.codex = new Codex({
      config: {
        model: this.resolveModel(options.agentName),
        "permissions.approval_policy": options.config.approval_policy ?? "on-request",
        "permissions.sandbox_mode": options.config.sandbox_mode ?? "workspace-write",
      },
      env: this.buildEnv(options.config),
    })
  }

  async startSession(input: string): Promise<StreamedTurn> {
    const threadOptions = this.buildThreadOptions()
    this.primaryThread = this.codex.startThread(threadOptions)
    return this.primaryThread.runStreamed(input)
  }

  async continueTurn(input: string): Promise<StreamedTurn> {
    if (!this.primaryThread) throw new Error("No active thread")
    return this.primaryThread.runStreamed(input)
  }

  async resumeSession(threadId: string, input: string): Promise<StreamedTurn> {
    const threadOptions = this.buildThreadOptions()
    this.primaryThread = this.codex.resumeThread(threadId, threadOptions)
    return this.primaryThread.runStreamed(input)
  }

  getThreadId(): string | null {
    return this.primaryThread?.id ?? null
  }

  private buildThreadOptions(): ThreadOptions {
    const agentConfig = this.config.agents?.[this.config.active_agent ?? "sisyphus"]
    return {
      model: agentConfig?.model ?? "gpt-5.3-codex",
      sandboxMode: this.config.sandbox_mode ?? "workspace-write",
      workingDirectory: this.config.working_directory,
      modelReasoningEffort: agentConfig?.reasoningEffort ?? "high",
      networkAccessEnabled: true,
      webSearchMode: "live",
      approvalPolicy: this.config.approval_policy ?? "on-request",
    }
  }

  private resolveModel(agentName: string): string {
    const MODEL_MAP: Record<string, string> = {
      sisyphus: "gpt-5.3-codex",
      hephaestus: "gpt-5.3-codex",
      oracle: "gpt-5.2",
      atlas: "gpt-5.1",
      explore: "gpt-5-nano",
      librarian: "gpt-5.1",
    }
    return this.config.agents?.[agentName]?.model ?? MODEL_MAP[agentName] ?? "gpt-5.3-codex"
  }

  private buildEnv(config: OhMyCodexConfig): Record<string, string> {
    // env replaces process.env entirely - must include ALL needed vars
    return {
      ...process.env as Record<string, string>,
      ...(config.env ?? {}),
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
    }
  }
}
```

### 3.2 Event Loop

The event loop processes the JSONL event stream from `codex exec` and dispatches
to registered hooks. Note: `StreamedTurn.events` is the async generator property.

```typescript
// src/orchestrator/event-loop.ts

import type { ThreadEvent, StreamedTurn } from "@openai/codex-sdk"
import type { HookRegistry } from "../event-hooks/hook-registry"

export class EventLoop {
  constructor(
    private hooks: HookRegistry,
    private onOutput?: (text: string) => void,
  ) {}

  async processStream(stream: StreamedTurn): Promise<void> {
    // StreamedTurn.events is the async generator property
    for await (const event of stream.events) {
      await this.dispatch(event)
    }
  }

  private async dispatch(event: ThreadEvent): Promise<void> {
    switch (event.type) {
      case "thread.started":
        await this.hooks.emit("thread:started", { threadId: event.thread_id })
        break

      case "turn.started":
        await this.hooks.emit("turn:started", {})
        break

      case "turn.completed":
        await this.hooks.emit("turn:completed", { usage: event.usage })
        break

      case "turn.failed":
        await this.hooks.emit("turn:failed", { error: event.error })
        break

      case "item.started":
        await this.dispatchItem("started", event.item)
        break

      case "item.completed":
        await this.dispatchItem("completed", event.item)
        break

      case "item.updated":
        await this.dispatchItem("updated", event.item)
        break

      case "error":
        await this.hooks.emit("error", { message: event.message })
        break
    }
  }

  private async dispatchItem(
    phase: "started" | "updated" | "completed",
    item: ThreadItem,
  ): Promise<void> {
    await this.hooks.emit(`item:${phase}`, { item })

    switch (item.type) {
      case "file_change":
        await this.hooks.emit(`file_change:${phase}`, { item })
        break
      case "todo_list":
        await this.hooks.emit(`todo_list:${phase}`, { item })
        break
      case "command_execution":
        await this.hooks.emit(`command:${phase}`, { item })
        break
      case "mcp_tool_call":
        await this.hooks.emit(`mcp_tool:${phase}`, { item })
        break
      case "agent_message":
        this.onOutput?.(item.text)
        break
    }
  }
}
```

### 3.3 Thread Pool (Background Agents)

Background agents are implemented as additional `Thread` instances.

```typescript
// src/orchestrator/thread-pool.ts

import { Codex, type ThreadOptions } from "@openai/codex-sdk"
import { EventLoop } from "./event-loop"
import type { HookRegistry } from "../event-hooks/hook-registry"

export type BackgroundThread = {
  id: string
  threadId: string | null
  title: string
  status: "running" | "completed" | "failed" | "cancelled"
  startedAt: number
  result?: string
  error?: string
}

export class ThreadPool {
  private threads = new Map<string, BackgroundThread>()
  private runningCount = 0
  private taskCounter = 0

  constructor(
    private codex: Codex,
    private hooks: HookRegistry,
    private maxConcurrent: number = 5,
  ) {}

  async spawn(args: {
    prompt: string
    model?: string
    title: string
    parentThreadId?: string
    threadOptions?: Partial<ThreadOptions>
  }): Promise<string> {
    if (this.runningCount >= this.maxConcurrent) {
      throw new Error(`Max concurrent threads (${this.maxConcurrent}) reached`)
    }

    const taskId = `bg_${++this.taskCounter}_${Date.now().toString(36)}`
    const thread = this.codex.startThread({
      model: args.model ?? "gpt-5.1",
      sandboxMode: "workspace-write",
      ...args.threadOptions,
    })

    const bgThread: BackgroundThread = {
      id: taskId,
      threadId: null,
      title: args.title,
      status: "running",
      startedAt: Date.now(),
    }
    this.threads.set(taskId, bgThread)
    this.runningCount++

    this.runThread(taskId, thread, args.prompt).catch((error) => {
      const t = this.threads.get(taskId)
      if (t) {
        t.status = "failed"
        t.error = String(error)
      }
      this.runningCount--
    })

    return taskId
  }

  private async runThread(
    taskId: string,
    thread: Thread,
    prompt: string,
  ): Promise<void> {
    const bgThread = this.threads.get(taskId)!
    const stream = await thread.runStreamed(prompt)
    bgThread.threadId = thread.id

    const eventLoop = new EventLoop(this.hooks)
    await eventLoop.processStream(stream)

    bgThread.status = "completed"
    bgThread.result = stream.finalResponse
    this.runningCount--

    await this.hooks.emit("background:completed", {
      taskId,
      threadId: thread.id,
      result: stream.finalResponse,
    })
  }

  getTask(taskId: string): BackgroundThread | undefined {
    return this.threads.get(taskId)
  }

  listTasks(): BackgroundThread[] {
    return Array.from(this.threads.values())
  }

  async cancel(taskId: string): Promise<void> {
    const thread = this.threads.get(taskId)
    if (thread && thread.status === "running") {
      thread.status = "cancelled"
      this.runningCount--
    }
  }
}
```

### 3.4 Orchestrator (Main Entry)

```typescript
// src/orchestrator/orchestrator.ts

import { Codex } from "@openai/codex-sdk"
import { CodexWrapper } from "./codex-wrapper"
import { EventLoop } from "./event-loop"
import { ThreadPool } from "./thread-pool"
import { HookRegistry } from "../event-hooks/hook-registry"
import { startMcpServer } from "../mcp-server/server"
import { loadConfig } from "../config/config-loader"
import { generateInstructions } from "../instructions/agents-md-generator"
import { generateCodexConfig } from "../config/codex-config-writer"
import { registerAllHooks } from "../event-hooks/register-all-hooks"

export async function createOrchestrator(args: {
  workingDirectory: string
  agentName?: string
  prompt?: string
}) {
  // 1. Load oh-my-codex config
  const config = loadConfig(args.workingDirectory)

  // 2. Generate Codex config.toml (includes MCP server registration)
  const mcpServerPort = await generateCodexConfig(config, args.workingDirectory)

  // 3. Start our MCP server (stdio-based, registered in config.toml)
  const mcpProcess = await startMcpServer(config, args.workingDirectory)

  // 4. Generate instructions (AGENTS.md content)
  const agentName = args.agentName ?? config.default_agent ?? "sisyphus"
  const instructions = generateInstructions(agentName, config)

  // 5. Create Codex wrapper
  const wrapper = new CodexWrapper({
    config,
    workingDirectory: args.workingDirectory,
    agentName,
    instructions,
    mcpServerCommand: mcpProcess.command,
    externalMcpServers: config.external_mcps ?? {},
  })

  // 6. Create hook registry and register hooks
  const hookRegistry = new HookRegistry()
  const threadPool = new ThreadPool(wrapper.codex, hookRegistry, config.background_task?.max_concurrent ?? 5)
  registerAllHooks(hookRegistry, config, wrapper, threadPool)

  // 7. Create event loop
  const eventLoop = new EventLoop(hookRegistry)

  return { wrapper, eventLoop, threadPool, hookRegistry, config }
}
```

---

## 4. MCP Server Design

### 4.1 Overview

Our 22 custom tools are exposed as an MCP server that Codex connects to via
the `[mcp_servers]` section of `config.toml`. The server uses stdio transport.

### 4.2 Tool Mapping: oh-my-opencodex -> oh-my-codex MCP

| Current Tool | MCP Tool | Status | Notes |
|-------------|----------|--------|-------|
| `lsp_goto_definition` | `lsp_goto_definition` | KEPT | Direct port |
| `lsp_find_references` | `lsp_find_references` | KEPT | Direct port |
| `lsp_symbols` | `lsp_symbols` | KEPT | Direct port |
| `lsp_diagnostics` | `lsp_diagnostics` | KEPT | Direct port |
| `lsp_prepare_rename` | `lsp_prepare_rename` | KEPT | Direct port |
| `lsp_rename` | `lsp_rename` | KEPT | Direct port |
| `ast_grep_search` | `ast_grep_search` | KEPT | Direct port |
| `ast_grep_replace` | `ast_grep_replace` | KEPT | Direct port |
| `grep` | `grep` | KEPT | Direct port |
| `glob` | `glob` | KEPT | Direct port |
| `call_omo_agent` | `call_agent` | ADAPTED | Renamed; uses ThreadPool |
| `background_output` | `background_output` | ADAPTED | Reads from ThreadPool |
| `background_cancel` | `background_cancel` | ADAPTED | Cancels ThreadPool tasks |
| `task` (delegate) | `delegate_task` | ADAPTED | Category delegation via ThreadPool |
| `look_at` | `look_at` | KEPT | Direct port |
| `interactive_bash` | `interactive_bash` | KEPT | Tmux integration |
| `skill` | `skill` | KEPT | Skill loader |
| `skill_mcp` | `skill_mcp` | KEPT | Skill MCP bridge |
| `slashcommand` | `slashcommand` | KEPT | Command execution |
| `session_list` | `session_list` | ADAPTED | Reads from SessionStore |
| `session_read` | `session_read` | ADAPTED | Reads from SessionStore |
| `session_search` | `session_search` | ADAPTED | Searches SessionStore |
| `session_info` | `session_info` | ADAPTED | Reads from SessionStore |
| `task_create` | REMOVED | — | Codex has native `todo_list` items |
| `task_get` | REMOVED | — | Use `todo_list` events |
| `task_list` | REMOVED | — | Use `todo_list` events |
| `task_update` | REMOVED | — | Use `todo_list` events |

**Final count: 22 MCP tools** (26 original - 4 task tools replaced by native Codex todo_list)

### 4.3 MCP Server Implementation

```typescript
// src/mcp-server/server.ts

import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server"
import { registerTools } from "./tool-registry"
import { registerResources } from "./resource-registry"
import { registerPrompts } from "./prompt-registry"
import type { OhMyCodexConfig } from "../config/schema/oh-my-codex-config"

export async function startMcpServer(
  config: OhMyCodexConfig,
  workingDirectory: string,
): Promise<void> {
  const server = new McpServer({
    name: "oh-my-codex",
    version: "1.0.0",
  })

  registerTools(server, config, workingDirectory)
  registerResources(server, config, workingDirectory)
  registerPrompts(server, config)

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
```

### 4.4 Tool Registration Pattern

```typescript
// src/mcp-server/tool-registry.ts

import { McpServer } from "@modelcontextprotocol/server"
import * as z from "zod/v4"
import type { OhMyCodexConfig } from "../config/schema/oh-my-codex-config"

export function registerTools(
  server: McpServer,
  config: OhMyCodexConfig,
  workingDirectory: string,
): void {
  const disabledTools = new Set(config.disabled_tools ?? [])

  // LSP Tools (6)
  if (!disabledTools.has("lsp_goto_definition")) {
    server.registerTool(
      "lsp_goto_definition",
      {
        title: "Go to Definition",
        description: "Jump to symbol definition. Find WHERE something is defined.",
        inputSchema: z.object({
          filePath: z.string().describe("Absolute path to the file"),
          line: z.number().min(1).describe("Line number (1-indexed)"),
          character: z.number().min(0).describe("Character position"),
        }),
      },
      async ({ filePath, line, character }) => {
        const { lspGotoDefinition } = await import("../tools/lsp/goto-definition")
        const result = await lspGotoDefinition(filePath, line, character)
        return { content: [{ type: "text", text: JSON.stringify(result) }] }
      },
    )
  }

  // AST-Grep Tools (2)
  if (!disabledTools.has("ast_grep_search")) {
    server.registerTool(
      "ast_grep_search",
      {
        title: "AST-Grep Search",
        description: "Search code patterns using AST-aware matching.",
        inputSchema: z.object({
          pattern: z.string(),
          lang: z.enum(["typescript", "javascript", "python" /* ... */]),
          paths: z.array(z.string()).optional(),
          globs: z.array(z.string()).optional(),
          context: z.number().optional(),
        }),
      },
      async (args) => {
        const { astGrepSearch } = await import("../tools/ast-grep/search")
        const result = await astGrepSearch(args, workingDirectory)
        return { content: [{ type: "text", text: result }] }
      },
    )
  }

  // ... remaining tools follow same pattern
}
```

### 4.5 MCP Resources (Context Injection)

Instead of OpenCode's `chat.messages.transform` hook, we expose context as
MCP resources that Codex can query.

```typescript
// src/mcp-server/resource-registry.ts

import { McpServer } from "@modelcontextprotocol/server"

export function registerResources(
  server: McpServer,
  config: OhMyCodexConfig,
  workingDirectory: string,
): void {
  server.registerResource(
    "project://agents-md",
    {
      title: "AGENTS.md",
      description: "Project architecture and agent instructions",
      mimeType: "text/markdown",
    },
    async () => {
      const content = await readFileIfExists(
        path.join(workingDirectory, "AGENTS.md"),
      )
      return { contents: [{ uri: "project://agents-md", text: content ?? "" }] }
    },
  )

  server.registerResource(
    "session://current",
    {
      title: "Current Session",
      description: "Current session state and todo list",
      mimeType: "application/json",
    },
    async () => {
      const state = getSessionState()
      return {
        contents: [{
          uri: "session://current",
          text: JSON.stringify(state),
        }],
      }
    },
  )
}
```

### 4.6 MCP Prompts (Agent Templates)

Agent system prompts are exposed as MCP prompts so Codex can load them.

```typescript
// src/mcp-server/prompt-registry.ts

import { McpServer } from "@modelcontextprotocol/server"
import * as z from "zod/v4"

export function registerPrompts(
  server: McpServer,
  config: OhMyCodexConfig,
): void {
  server.registerPrompt(
    "sisyphus",
    {
      title: "Sisyphus Agent",
      description: "Main orchestrator agent with task management and delegation",
      argsSchema: z.object({
        task: z.string().describe("The task to accomplish"),
      }),
    },
    ({ task }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: buildSisyphusPrompt(task, config),
        },
      }],
    }),
  )

  // Additional agent prompts: oracle, hephaestus, explore, librarian
}
```

### 4.7 External MCP Registration

The 3 built-in MCPs (websearch, context7, grep_app) are registered directly
in the generated `config.toml` rather than through our MCP server.

```toml
# Generated ~/.codex/config.toml (or .codex/config.toml)

[mcp_servers.oh-my-codex]
command = "oh-my-codex"
args = ["mcp-server"]
enabled = true

[mcp_servers.websearch]
type = "http"
url = "https://mcp.exa.ai"
headers = { "x-api-key" = "${EXA_API_KEY}" }
enabled = true

[mcp_servers.context7]
type = "http"
url = "https://mcp.context7.com/mcp"
enabled = true

[mcp_servers.grep_app]
type = "http"
url = "https://mcp.grep.app"
enabled = true
```

---

## 5. Config System

### 5.1 Two-Layer Configuration

oh-my-codex uses a two-layer config system:

1. **oh-my-codex config** (JSONC) — Plugin-specific settings
   - Project: `.codex/oh-my-codex.jsonc`
   - User: `~/.config/codex/oh-my-codex.jsonc`

2. **Codex config** (TOML) — Generated from oh-my-codex config
   - Project: `.codex/config.toml`
   - User: `~/.codex/config.toml`

```
oh-my-codex.jsonc (source of truth)
       │
       ▼
  loadConfig()
       │
       ├──→ Oh-my-codex features (hooks, tools, skills)
       │
       └──→ generateCodexConfig()
                  │
                  ▼
            config.toml (generated, Codex-native)
```

### 5.2 New Config Schema

```typescript
// src/config/schema/oh-my-codex-config.ts

import { z } from "zod"

export const OhMyCodexConfigSchema = z.object({
  $schema: z.string().optional(),

  // === Agent Configuration ===
  default_agent: z.enum(["sisyphus", "hephaestus", "atlas"]).optional(),
  agents: z.record(z.string(), z.object({
    model: z.string().optional(),
    reasoning_effort: z.enum(["minimal", "low", "medium", "high", "xhigh"]).optional(),
    temperature: z.number().min(0).max(2).optional(),
    prompt_append: z.string().optional(),
  })).optional(),

  // === Codex Settings ===
  approval_policy: z.enum(["never", "on-request", "on-failure", "untrusted"]).optional(),
  sandbox_mode: z.enum(["read-only", "workspace-write", "danger-full-access"]).optional(),
  web_search_mode: z.enum(["disabled", "cached", "live"]).optional(),

  // === Feature Toggles ===
  disabled_hooks: z.array(z.string()).optional(),
  disabled_tools: z.array(z.string()).optional(),
  disabled_mcps: z.array(z.string()).optional(),
  disabled_skills: z.array(z.string()).optional(),

  // === Feature Configs ===
  background_task: z.object({
    max_concurrent: z.number().min(1).max(10).optional(),
  }).optional(),
  comment_checker: z.object({
    enabled: z.boolean().optional(),
    auto_fix: z.boolean().optional(),
  }).optional(),
  ralph_loop: z.object({
    enabled: z.boolean().optional(),
    max_iterations: z.number().optional(),
  }).optional(),
  boulder: z.object({
    enabled: z.boolean().optional(),
    max_retries: z.number().optional(),
  }).optional(),

  // === Categories (for task delegation) ===
  categories: z.record(z.string(), z.object({
    model: z.string(),
    description: z.string().optional(),
    reasoning_effort: z.enum(["minimal", "low", "medium", "high", "xhigh"]).optional(),
  })).optional(),

  // === Skills ===
  skills: z.object({
    paths: z.array(z.string()).optional(),
    recursive: z.boolean().optional(),
  }).optional(),

  // === Notifications ===
  notification: z.object({
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
  }).optional(),

  // === Tmux ===
  tmux: z.object({
    enabled: z.boolean().optional(),
    layout: z.string().optional(),
  }).optional(),

  // === Environment ===
  env: z.record(z.string(), z.string()).optional(),

  // === Migration tracking ===
  _migrations: z.array(z.string()).optional(),
})

export type OhMyCodexConfig = z.infer<typeof OhMyCodexConfigSchema>
```

### 5.3 Config Field Mapping

| oh-my-opencodex Field | oh-my-codex Field | Notes |
|----------------------|-------------------|-------|
| `agents` | `agents` | Simplified: only model, reasoning_effort, temp |
| `disabled_agents` | REMOVED | Not needed; fewer agents |
| `disabled_mcps` | `disabled_mcps` | Same |
| `disabled_hooks` | `disabled_hooks` | Same |
| `disabled_tools` | `disabled_tools` | Same |
| `disabled_skills` | `disabled_skills` | Same |
| `disabled_commands` | REMOVED | Commands moved to skills |
| `categories` | `categories` | Simplified; OpenAI models only |
| `claude_code` | REMOVED | No Claude Code compatibility |
| `sisyphus_agent` | Merged into `agents.sisyphus` | |
| `comment_checker` | `comment_checker` | Same |
| `experimental` | REMOVED | Features graduate or drop |
| `ralph_loop` | `ralph_loop` | Same |
| `background_task` | `background_task` | Simplified |
| `notification` | `notification` | Same |
| `babysitting` | REMOVED | Not needed with single provider |
| `git_master` | Moved to skills | |
| `browser_automation_engine` | Moved to skills | |
| `websearch` | REMOVED | Configured via MCPs |
| `tmux` | `tmux` | Same |
| `sisyphus` | REMOVED | Merged into main config |
| — | `approval_policy` | NEW: Codex approval policy |
| — | `sandbox_mode` | NEW: Codex sandbox mode |
| — | `web_search_mode` | NEW: Codex web search |
| — | `default_agent` | NEW: Default agent selection |

### 5.4 Codex Config Generation

```typescript
// src/config/codex-config-writer.ts

import * as toml from "@iarna/toml"
import type { OhMyCodexConfig } from "./schema/oh-my-codex-config"

export function generateCodexConfig(
  config: OhMyCodexConfig,
  workingDirectory: string,
): string {
  const codexConfig: Record<string, unknown> = {
    model: config.agents?.sisyphus?.model ?? "gpt-5.3-codex",

    permissions: {
      approval_policy: config.approval_policy ?? "on-request",
      sandbox_mode: config.sandbox_mode ?? "workspace-write",
    },

    features: {
      web_search_request: config.web_search_mode !== "disabled",
    },

    // Register our MCP server
    mcp_servers: {
      "oh-my-codex": {
        command: "oh-my-codex",
        args: ["mcp-server", "--dir", workingDirectory],
        enabled: true,
      },
      ...(config.disabled_mcps?.includes("websearch") ? {} : {
        websearch: {
          type: "http",
          url: "https://mcp.exa.ai",
          enabled: true,
        },
      }),
      ...(config.disabled_mcps?.includes("context7") ? {} : {
        context7: {
          type: "http",
          url: "https://mcp.context7.com/mcp",
          enabled: true,
        },
      }),
      ...(config.disabled_mcps?.includes("grep_app") ? {} : {
        grep_app: {
          type: "http",
          url: "https://mcp.grep.app",
          enabled: true,
        },
      }),
    },
  }

  if (config.notification?.command) {
    codexConfig.notify = {
      command: config.notification.command,
      args: config.notification.args ?? [],
    }
  }

  return toml.stringify(codexConfig)
}
```

### 5.5 Migration from oh-my-opencodex Config

```typescript
// src/config/migration.ts

import type { OhMyCodexConfig } from "./schema/oh-my-codex-config"

const OPENAI_MODEL_MAP: Record<string, string> = {
  "claude-opus-4-6": "gpt-5.3-codex",
  "claude-sonnet-4-5": "gpt-5.1",
  "claude-haiku-4-5": "gpt-5-nano",
  "gemini-3-pro": "gpt-5.2",
  "gemini-3-flash": "gpt-5-nano",
  "grok-code-fast-1": "gpt-5-nano",
  "glm-4.7": "gpt-5.1",
  "kimi-k2.5": "gpt-5.1",
}

export function migrateConfig(legacy: Record<string, unknown>): OhMyCodexConfig {
  const migrated: OhMyCodexConfig = {
    default_agent: (legacy.default_run_agent as string) ?? "sisyphus",
    disabled_hooks: legacy.disabled_hooks as string[],
    disabled_tools: legacy.disabled_tools as string[],
    disabled_mcps: legacy.disabled_mcps as string[],
    disabled_skills: legacy.disabled_skills as string[],

    agents: migrateAgents(legacy.agents as Record<string, any>),
    categories: migrateCategories(legacy.categories as Record<string, any>),

    comment_checker: legacy.comment_checker as any,
    ralph_loop: legacy.ralph_loop as any,
    background_task: legacy.background_task
      ? { max_concurrent: (legacy.background_task as any).max_concurrent }
      : undefined,
    notification: legacy.notification as any,
    tmux: legacy.tmux
      ? { enabled: (legacy.tmux as any).enabled, layout: (legacy.tmux as any).layout }
      : undefined,

    _migrations: [...((legacy._migrations as string[]) ?? []), "opencodex-to-codex-v1"],
  }

  return migrated
}

function migrateAgents(
  agents?: Record<string, any>,
): OhMyCodexConfig["agents"] {
  if (!agents) return undefined
  const result: Record<string, any> = {}
  for (const [name, config] of Object.entries(agents)) {
    result[name] = {
      model: config.model ? (OPENAI_MODEL_MAP[config.model] ?? config.model) : undefined,
      reasoning_effort: config.reasoningEffort,
      temperature: config.temperature,
      prompt_append: config.prompt_append,
    }
  }
  return result
}

function migrateCategories(
  categories?: Record<string, any>,
): OhMyCodexConfig["categories"] {
  if (!categories) return undefined
  const result: Record<string, any> = {}
  for (const [name, config] of Object.entries(categories)) {
    result[name] = {
      model: config.model ? (OPENAI_MODEL_MAP[config.model] ?? config.model) : config.model,
      description: config.description,
      reasoning_effort: config.reasoningEffort,
    }
  }
  return result
}
```

---

## 6. Agent Prompts Adaptation

### 6.1 Strategy

In oh-my-opencodex, agent prompts are embedded in `AgentConfig.instructions`
and dynamically composed via `dynamic-agent-prompt-builder.ts`. In oh-my-codex,
these become:

1. **AGENTS.md** — Project-level instructions auto-generated or user-written (32 KiB limit, loaded once per run)
2. **developer_instructions** — `config.toml` field for persistent behavioral instructions
3. **Thread instructions** — Injected via `ThreadOptions` at turn start

> **Important**: `.codex/rules/` uses Starlark `.rules` files for command approval policies only. Agent behavioral instructions go in `developer_instructions` or AGENTS.md, NOT in rules files.

### 6.2 Agent Reduction: 11 -> 6

| Current Agent | Kept? | Codex Equivalent | Rationale |
|--------------|-------|------------------|-----------|
| **Sisyphus** | YES | Primary agent prompt in instructions | Core orchestrator |
| **Hephaestus** | YES | Alternative agent prompt | Autonomous worker |
| **Oracle** | YES | Background thread with read-only tools | Consultant |
| **Librarian** | YES | Background thread with search tools | Research |
| **Explore** | YES | Background thread with grep/glob only | Fast search |
| **Atlas** | YES | Alternative primary prompt | Todo orchestrator |
| **Metis** | DROPPED | — | Merged into Sisyphus planning phase |
| **Momus** | DROPPED | — | Plan review merged into Oracle |
| **Prometheus** | DROPPED | — | Planning merged into Sisyphus |
| **Multimodal-Looker** | DROPPED | Native Codex vision | Codex handles vision natively |
| **Sisyphus-Junior** | DROPPED | — | Category delegation handles this |

### 6.3 Prompt Architecture

```typescript
// src/instructions/agents-md-generator.ts

export function generateInstructions(
  agentName: string,
  config: OhMyCodexConfig,
): string {
  const agentPrompt = AGENT_PROMPTS[agentName]
  if (!agentPrompt) throw new Error(`Unknown agent: ${agentName}`)

  const sections = [
    agentPrompt.coreInstructions,
    buildToolGuidanceSection(config),
    buildDelegationSection(config),
    buildCategorySection(config),
    config.agents?.[agentName]?.prompt_append ?? "",
  ]

  return sections.filter(Boolean).join("\n\n")
}
```

### 6.4 Sisyphus Prompt Adaptation

The Sisyphus prompt (~559 LOC) needs these adaptations:

**Keep as-is:**
- Task Management section (todo_list items map naturally to Codex's native `TodoListItem`)
- Delegation Table (adapts to ThreadPool-based delegation)
- Anti-patterns section
- Boulder (todo enforcement) references

**Adapt:**
- Tool Selection Table -> Reference MCP tools by `oh-my-codex/tool_name`
- Agent invocation -> Use `call_agent` MCP tool instead of `call_omo_agent`
- Model references -> Replace all multi-provider models with OpenAI equivalents
- Context management -> Remove OpenCode-specific compaction references

**Remove:**
- Claude Code compatibility references
- OpenCode-specific tool names (`TodoWrite` -> native `todo_list`)
- Multi-provider fallback chain instructions
- OpenCode session management specifics

### 6.5 Instructions Generation (replacing rules)

Behavioral instructions that were hooks become `developer_instructions` in config.toml
and AGENTS.md content:

```
AGENTS.md content includes:
├── Agent core instructions (Sisyphus/Hephaestus/Atlas)
├── Tool guidance (MCP tool usage patterns)
├── Delegation guide (when to use background threads)
├── Coding standards (modular code, 200 LOC limit)
├── Comment checker rules (AI comment detection)
└── Task management rules (todo enforcement)
```

> Note: `.codex/rules/` is reserved for Starlark command approval policies only.

---

## 7. Feature Parity Matrix

### 7.1 All 41 Hooks — Disposition

#### Session Hooks (19)

| Hook | Status | Implementation in oh-my-codex |
|------|--------|------------------------------|
| `context-window-monitor` | ADAPTED | Watch `turn.completed` event `usage` field for token counts |
| `session-recovery` | ADAPTED | Watch `turn.failed` events; auto-retry with `thread.run()` |
| `session-notification` | ADAPTED | Watch `turn.completed` -> trigger OS notification |
| `think-mode` | ADAPTED | Set `modelReasoningEffort: "xhigh"` in `ThreadOptions` |
| `anthropic-context-window-limit-recovery` | DROPPED | Anthropic-specific; Codex manages its own context |
| `auto-update-checker` | KEPT | Check npm registry on startup (CLI layer) |
| `agent-usage-reminder` | ADAPTED | Inject reminder at turn boundaries via instructions |
| `non-interactive-env` | ADAPTED | `codex exec` mode handles this natively |
| `interactive-bash-session` | KEPT | Tmux integration via MCP tool |
| `ralph-loop` | ADAPTED | Watch `turn.completed` -> auto-start new turn with continuation prompt |
| `edit-error-recovery` | DROPPED | Codex handles edit errors internally |
| `json-error-recovery` | DROPPED | Codex handles JSON parsing internally |
| `delegate-task-retry` | ADAPTED | ThreadPool handles retries |
| `task-resume-info` | ADAPTED | ThreadPool tracks task state |
| `start-work` | ADAPTED | Inject via instructions at thread start |
| `prometheus-md-only` | DROPPED | Prometheus agent removed |
| `sisyphus-junior-notepad` | DROPPED | Sisyphus-Junior removed |
| `question-label-truncator` | DROPPED | Not needed; Codex manages labels |
| `preemptive-compaction` | DROPPED | Codex manages context compaction internally |

#### Tool-Guard Hooks (9)

| Hook | Status | Implementation in oh-my-codex |
|------|--------|------------------------------|
| `comment-checker` | ADAPTED | Watch `file_change:completed` events -> run comment-checker CLI |
| `rules-injector` | ADAPTED | Generate instructions at startup instead of runtime injection |
| `write-existing-file-guard` | DROPPED | Codex `sandboxMode` handles file permissions |
| `directory-readme-injector` | ADAPTED | MCP resource `project://readme` |
| `directory-agents-injector` | ADAPTED | MCP resource `project://agents-md` |
| `question-label-truncator` (tool) | DROPPED | Not needed |
| `tool-output-truncator` | ADAPTED | MCP tool handlers truncate their own output |
| `session-notification-formatting` | DROPPED | Simplified notification |
| `unstable-agent-babysitter` | DROPPED | Single provider; no unstable models |

#### Transform Hooks (4)

| Hook | Status | Implementation in oh-my-codex |
|------|--------|------------------------------|
| `claude-code-hooks` | DROPPED | No Claude Code compatibility |
| `keyword-detector` | ADAPTED | Parse user input for "ultrawork"/"ulw" before sending to Codex |
| `context-injector` | ADAPTED | MCP resources + instructions generation |
| `thinking-block-validator` | DROPPED | OpenAI models don't have thinking blocks |

#### Continuation Hooks (7)

| Hook | Status | Implementation in oh-my-codex |
|------|--------|------------------------------|
| `todo-continuation-enforcer` | ADAPTED | Watch `todo_list:completed` items; if incomplete todos remain at `turn.completed`, auto-start new turn |
| `atlas` | ADAPTED | Atlas agent prompt + ThreadOptions for todo management |
| `stop-continuation-guard` | ADAPTED | Check for `/stop-continuation` in user messages |
| `background-notification` | ADAPTED | ThreadPool emits `background:completed` events |
| `empty-task-response-detector` | ADAPTED | Check `turn.completed` response length |
| `session-todo-status` | ADAPTED | Track via `todo_list` item events |
| `tasks-todowrite-disabler` | DROPPED | No TodoWrite tool; native todo_list |

#### Skill Hooks (2)

| Hook | Status | Implementation in oh-my-codex |
|------|--------|------------------------------|
| `category-skill-reminder` | ADAPTED | Inject into instructions at thread start |
| `auto-slash-command` | ADAPTED | Parse input for `/` prefix; execute via slashcommand MCP tool |

### 7.2 Summary

| Category | Total | Kept/Adapted | Dropped |
|----------|-------|-------------|---------|
| Session Hooks | 19 | 10 | 9 |
| Tool-Guard Hooks | 9 | 4 | 5 |
| Transform Hooks | 4 | 2 | 2 |
| Continuation Hooks | 7 | 6 | 1 |
| Skill Hooks | 2 | 2 | 0 |
| **Total** | **41** | **24** | **17** |

### 7.3 Feature Comparison

| Feature | oh-my-opencodex | oh-my-codex | Notes |
|---------|----------------|-------------|-------|
| Multi-model orchestration | 7+ providers | OpenAI only | Simplified |
| Agent count | 11 | 6 | Merged/dropped |
| Tool count | 26 | 22 | 4 task tools -> native |
| Hook count | 41 | 24 | 17 dropped |
| Claude Code compat | Yes (~2110 LOC) | No | Removed |
| Background agents | OpenCode sessions | Codex Threads | Cleaner |
| MCP integration | 3-tier system | Direct config.toml | Simpler |
| Config format | JSONC only | JSONC + TOML | Dual-layer |
| Todo enforcement | Hook-based | Event-based | Same behavior |
| Ralph Loop | Hook-based | Event-based | Same behavior |
| Comment checker | Pre-tool hook | Post-file-change event | Same behavior |
| Context injection | Message transform | MCP resources | Equivalent |
| Skills | .opencode/skills/ | .codex/skills/ | Path change |
| Commands | Built-in + Claude Code | Built-in only | Simplified |

---

## 8. Migration Plan

### 8.1 Phase Overview

```
Phase 0: Setup (1 day)
  └─→ New repo, package.json, tsconfig, CI

Phase 1: Core Infrastructure (3-5 days)
  └─→ Config system, Codex wrapper, event loop

Phase 2: MCP Server (3-5 days)
  └─→ Tool migration, resource/prompt registration

Phase 3: Event Hooks (3-5 days)
  └─→ 24 hooks as event listeners

Phase 4: Agent Prompts (2-3 days)
  └─→ Sisyphus, Hephaestus, Oracle, Explore, Librarian, Atlas

Phase 5: CLI (2-3 days)
  └─→ oh-my-codex CLI commands

Phase 6: Features (3-5 days)
  └─→ Background agents, boulder, ralph-loop, skills

Phase 7: Testing & Polish (3-5 days)
  └─→ Integration tests, docs, edge cases
```

### 8.2 Phase 0: Project Setup

**Duration**: 1 day

1. Create new repository `oh-my-codex`
2. Initialize `package.json`:
   ```json
   {
     "name": "oh-my-codex",
     "version": "1.0.0",
     "bin": { "oh-my-codex": "./bin/oh-my-codex.js" },
     "dependencies": {
       "@openai/codex-sdk": "^0.1.0",
       "@modelcontextprotocol/sdk": "^1.25.0",
       "@ast-grep/napi": "^0.40.0",
       "commander": "^14.0.0",
       "vscode-jsonrpc": "^8.2.0",
       "zod": "^4.1.0",
       "@iarna/toml": "^3.0.0"
     }
   }
   ```
3. Copy `tsconfig.json`, adapt build scripts
4. Set up directory structure per Section 2
5. Copy LICENSE, set up CI/CD

### 8.3 Phase 1: Core Infrastructure

**Duration**: 3-5 days

**Tasks:**
1. **Config system** (`src/config/`)
   - Port `jsonc-parser.ts` from shared/
   - Create `OhMyCodexConfigSchema` (Zod v4)
   - Implement `config-loader.ts` (JSONC parse -> merge -> validate)
   - Implement `codex-config-writer.ts` (TOML generation)
   - Implement `migration.ts` (oh-my-opencodex -> oh-my-codex)

2. **Codex SDK wrapper** (`src/orchestrator/`)
   - Implement `codex-wrapper.ts` (Thread lifecycle)
   - Implement `event-loop.ts` (JSONL event dispatch)
   - Implement `thread-pool.ts` (background threads)
   - Implement `orchestrator.ts` (main entry)

3. **Shared utilities** (`src/shared/`)
   - Port: `logger.ts`, `deep-merge.ts`, `file-utils.ts`, `command-executor.ts`
   - New: `toml-writer.ts`

**Deliverable**: Can start a Codex thread, receive events, and log them.

### 8.4 Phase 2: MCP Server

**Duration**: 3-5 days

**Tasks:**
1. **Server scaffold** (`src/mcp-server/`)
   - Implement `server.ts` with stdio transport
   - Implement `tool-registry.ts` (registration framework)
   - Implement `resource-registry.ts`
   - Implement `prompt-registry.ts`

2. **Port tools** (`src/tools/`)
   - Port LSP tools (6): Direct copy, remove `@opencode-ai/plugin` types
   - Port AST-grep tools (2): Direct copy
   - Port grep/glob tools (2): Direct copy, adapt directory resolution
   - Port session tools (4): Adapt to new session store
   - Port interactive-bash: Direct copy
   - Port look-at: Direct copy
   - Port skill/skill-mcp/slashcommand: Adapt paths
   - Create background tools (2): Integrate with ThreadPool
   - Create call-agent/delegate-task: Integrate with ThreadPool

3. **Test**: Verify MCP server starts and responds to tool calls.

**Deliverable**: Standalone MCP server with 22 tools that Codex can call.

### 8.5 Phase 3: Event Hooks

**Duration**: 3-5 days

**Tasks:**
1. **Hook registry** (`src/event-hooks/`)
   - Implement typed `HookRegistry` with event dispatch
   - Implement hook registration pattern

2. **Turn hooks** (4):
   - `turn-started.ts` — Session tracking
   - `turn-completed.ts` — Usage monitoring, notification, continuation
   - `turn-failed.ts` — Error recovery
   - Thread started — Session initialization

3. **Item hooks** (6):
   - `file-change-checker.ts` — Comment checker integration
   - `todo-list-watcher.ts` — Boulder/continuation enforcement
   - `command-watcher.ts` — Command execution monitoring
   - `mcp-tool-watcher.ts` — MCP tool call tracking
   - Output handler — Agent message display

4. **Continuation hooks** (5):
   - `boulder.ts` — Todo enforcement
   - `ralph-loop.ts` — Iterative refinement
   - `stop-guard.ts` — Stop continuation
   - `empty-response-detector.ts`
   - `background-completed.ts`

5. **Session hooks** (4):
   - `session-recovery.ts`
   - `usage-monitor.ts`
   - `notification.ts`
   - `auto-update-checker.ts`

**Deliverable**: Full event-driven hook system with 24 hooks.

### 8.6 Phase 4: Agent Prompts

**Duration**: 2-3 days

**Tasks:**
1. **Port prompts** (`src/instructions/agent-prompts/`)
   - Sisyphus: Adapt 559 LOC prompt (remove OpenCode refs, update tool names)
   - Hephaestus: Adapt 507 LOC prompt
   - Oracle: Simplify to read-only consultant
   - Explore: Minimal search-focused prompt
   - Librarian: Minimal research prompt
   - Atlas: Todo management prompt

2. **Dynamic builder** (`src/instructions/dynamic-prompt-builder.ts`)
   - Port tool selection table generation
   - Port delegation table generation
   - Port category section generation
   - Remove multi-provider references

3. **Instructions generator** (`src/instructions/agents-md-generator.ts`)
   - Generate AGENTS.md content within 32 KiB limit

**Deliverable**: All 6 agent prompts functional.

### 8.7 Phase 5: CLI

**Duration**: 2-3 days

**Tasks:**
1. **CLI program** (`src/cli/cli-program.ts`)
   ```
   oh-my-codex [prompt]              # Interactive session
   oh-my-codex exec <prompt>         # Non-interactive
   oh-my-codex install               # Setup wizard
   oh-my-codex doctor                # Health check
   oh-my-codex mcp-server            # Start MCP server (for Codex to call)
   oh-my-codex migrate               # Migrate oh-my-opencodex config
   ```

2. **Install wizard**: API key setup, config generation
3. **Doctor**: Check Codex binary, config, MCP server, tools
4. **Start/exec**: Orchestrator integration

**Deliverable**: Working CLI.

### 8.8 Phase 6: Features

**Duration**: 3-5 days

**Tasks:**
1. **Background agents**: ThreadPool integration, spawn/cancel/list
2. **Boulder state**: Port persistence layer
3. **Ralph loop**: Port loop state controller
4. **Skills**: Port skill loader (`.codex/skills/` path)
5. **Tmux**: Port tmux session manager
6. **Session store**: Implement session persistence
7. **Context injector**: MCP resource-based injection

**Deliverable**: All features working.

### 8.9 Phase 7: Testing & Polish

**Duration**: 3-5 days

**Tasks:**
1. Integration tests for full workflow
2. Edge case handling (network errors, process crashes)
3. Documentation (README, installation guide)
4. npm package preparation
5. Binary builds for multiple platforms

**Total estimated duration: 20-32 days**

---

## 9. Package & Branding

### 9.1 Naming

| Aspect | Current | New |
|--------|---------|-----|
| npm package | `oh-my-opencodex` | `oh-my-codex` |
| Binary | `oh-my-opencodex` | `oh-my-codex` |
| Config dir | `.opencode/` | `.codex/` |
| Config file | `.opencode/oh-my-opencodex.jsonc` | `.codex/oh-my-codex.jsonc` |
| User config | `~/.config/opencode/oh-my-opencodex.jsonc` | `~/.config/codex/oh-my-codex.jsonc` |
| Log file | `/tmp/oh-my-opencodex.log` | `/tmp/oh-my-codex.log` |
| GitHub repo | `oh-my-opencodex` | `oh-my-codex` |

### 9.2 Package.json

```json
{
  "name": "oh-my-codex",
  "version": "1.0.0",
  "description": "The Best AI Agent Harness — Batteries-Included Codex Enhancement with Multi-Agent Orchestration, Parallel Background Threads, and Crafted LSP/AST Tools",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "type": "module",
  "bin": {
    "oh-my-codex": "./bin/oh-my-codex.js"
  },
  "files": ["dist", "bin"],
  "keywords": ["codex", "openai", "agents", "ai", "llm", "mcp"],
  "dependencies": {
    "@openai/codex-sdk": "^0.1.0",
    "@modelcontextprotocol/sdk": "^1.25.0",
    "@ast-grep/napi": "^0.40.0",
    "@ast-grep/cli": "^0.40.0",
    "@clack/prompts": "^0.11.0",
    "@code-yeongyu/comment-checker": "^0.6.0",
    "commander": "^14.0.0",
    "vscode-jsonrpc": "^8.2.0",
    "zod": "^4.1.0",
    "@iarna/toml": "^3.0.0",
    "picomatch": "^4.0.0"
  }
}
```

### 9.3 Binary Distribution

Same as oh-my-opencodex: npm package with optional platform-specific binaries.

```
oh-my-codex-darwin-arm64
oh-my-codex-darwin-x64
oh-my-codex-linux-arm64
oh-my-codex-linux-x64
oh-my-codex-windows-x64
```

### 9.4 Installation

```bash
# Install globally
npm install -g oh-my-codex

# Setup
oh-my-codex install

# Or let an agent do it
codex "Install and configure oh-my-codex from https://..."
```

### 9.5 How It Works (User Perspective)

```bash
# 1. Install
npm install -g oh-my-codex

# 2. Setup (generates config.toml + oh-my-codex.jsonc)
oh-my-codex install

# 3. Use Codex normally — oh-my-codex is registered as MCP server
codex "ultrawork: refactor the auth module"

# OR use oh-my-codex CLI directly (wraps Codex with full orchestration)
oh-my-codex "ultrawork: refactor the auth module"

# Non-interactive
oh-my-codex exec "fix all TypeScript errors"
```

---

## Summary

| Metric | Current (oh-my-opencodex) | New (oh-my-codex) |
|--------|--------------------------|-------------------|
| LOC | ~130k | ~35-45k |
| Agents | 11 | 6 |
| Hooks | 41 | 24 |
| Tools | 26 | 22 |
| Dependencies | 14 | 11 |
| Config fields | 26 | 18 |
| Migration phases | — | 7 phases, ~20-32 days |

### Key Corrections Applied

1. **`.codex/rules/` uses Starlark** `.rules` files for command approval policies only — NOT for agent behavioral instructions. All behavioral rules go in `AGENTS.md` or `developer_instructions` in config.toml.
2. **`StreamedTurn.events`** is the async generator property (not directly iterable from the stream object).
3. **`CodexOptions.env`** replaces `process.env` entirely — must include all needed environment variables.
4. **AGENTS.md has a 32 KiB limit** and is loaded once per run.
5. **MCP servers cannot be added per-session** via SDK — they must be pre-registered in `config.toml`.
