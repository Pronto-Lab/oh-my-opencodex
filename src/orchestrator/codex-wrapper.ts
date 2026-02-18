import type { OhMyCodexConfig } from "../config/schema/oh-my-codex-config"
import { log } from "../shared/logger"

type CodexOptions = {
  config?: Record<string, unknown>
  env?: Record<string, string>
}

type ThreadOptions = {
  model?: string
  sandboxMode?: string
  workingDirectory?: string
  modelReasoningEffort?: string
  networkAccessEnabled?: boolean
  webSearchMode?: string
  approvalPolicy?: string
}

type StreamedTurn = {
  events: AsyncGenerator<unknown>
  finalResponse?: string
}

type Thread = {
  id: string | null
  run(
    input: string,
    options?: { signal?: AbortSignal },
  ): Promise<{ items: unknown[]; finalResponse: string; usage: unknown }>
  runStreamed(input: string, options?: { signal?: AbortSignal }): Promise<StreamedTurn>
}

type Codex = {
  startThread(options: ThreadOptions): Thread
  resumeThread(id: string, options: ThreadOptions): Thread
}

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
  private codex: Codex | null = null
  private primaryThread: Thread | null = null
  private config: OhMyCodexConfig
  private agentName: string
  private workingDirectory: string

  constructor(options: CodexWrapperOptions) {
    this.config = options.config
    this.agentName = options.agentName
    this.workingDirectory = options.workingDirectory

    void ({} as CodexOptions)

    log("CodexWrapper created", {
      agent: options.agentName,
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
    if (!this.codex) {
      throw new Error("Codex SDK not initialized")
    }

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

  private getOrCreateThread(): Thread {
    if (!this.codex) {
      throw new Error("Codex SDK not initialized")
    }

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
