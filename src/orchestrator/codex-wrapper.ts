import {
  Codex,
  type CodexOptions,
  type RunStreamedResult,
  type Thread,
  type ThreadOptions,
} from "@openai/codex-sdk"
import type { OhMyCodexConfig } from "../config/schema/oh-my-codex-config"
import { log } from "../shared/logger"

export type StreamedTurn = RunStreamedResult
export type { Thread }

export type CodexWrapperOptions = {
  config: OhMyCodexConfig
  workingDirectory: string
  agentName: string
  instructions: string
}

const DEFAULT_MODEL_MAP: Record<string, string> = {
  sisyphus: "gpt-5.3-codex",
  hephaestus: "gpt-5.3-codex",
  oracle: "gpt-5.2",
  atlas: "gpt-5.1",
  explore: "gpt-5-nano",
  librarian: "gpt-5.1",
}

export class CodexWrapper {
  private codex: Codex
  private primaryThread: Thread | null = null
  private config: OhMyCodexConfig
  private agentName: string
  private workingDirectory: string

  constructor(options: CodexWrapperOptions) {
    this.config = options.config
    this.agentName = options.agentName
    this.workingDirectory = options.workingDirectory

    const codexOptions: CodexOptions = {
      env: this.buildEnv(),
    }
    this.codex = new Codex(codexOptions)

    log("CodexWrapper initialized", {
      agent: options.agentName,
      model: this.resolveModel(),
      workDir: options.workingDirectory,
    })
  }

  async startSession(input: string): Promise<StreamedTurn> {
    const thread = this.getOrCreateThread()
    return thread.runStreamed(input)
  }

  async continueTurn(input: string): Promise<StreamedTurn> {
    if (!this.primaryThread) {
      throw new Error("No active thread")
    }

    return this.primaryThread.runStreamed(input)
  }

  async resumeSession(threadId: string, input: string): Promise<StreamedTurn> {
    this.primaryThread = this.codex.resumeThread(threadId, this.buildThreadOptions())
    return this.primaryThread.runStreamed(input)
  }

  getThreadId(): string | null {
    return this.primaryThread?.id ?? null
  }

  resolveModel(agentName?: string): string {
    const name = agentName ?? this.agentName
    return this.config.agents?.[name]?.model ?? DEFAULT_MODEL_MAP[name] ?? "gpt-5.3-codex"
  }

  createThread(overrides?: Partial<ThreadOptions>): Thread {
    return this.codex.startThread({ ...this.buildThreadOptions(), ...overrides })
  }

  private getOrCreateThread(): Thread {
    if (!this.primaryThread) {
      this.primaryThread = this.codex.startThread(this.buildThreadOptions())
    }
    return this.primaryThread
  }

  private buildThreadOptions(): ThreadOptions {
    const agentConfig = this.config.agents?.[this.agentName]

    return {
      model: this.resolveModel(),
      sandboxMode: this.config.sandbox_mode ?? "workspace-write",
      workingDirectory: this.workingDirectory,
      modelReasoningEffort: agentConfig?.reasoning_effort ?? "high",
      networkAccessEnabled: true,
      webSearchMode: this.config.web_search_mode ?? "live",
      approvalPolicy: this.config.approval_policy ?? "on-request",
    }
  }

  buildEnv(): Record<string, string> {
    return {
      ...(process.env as Record<string, string>),
      ...(this.config.env ?? {}),
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
    }
  }
}
