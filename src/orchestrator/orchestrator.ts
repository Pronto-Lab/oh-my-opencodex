import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { loadConfig } from "../config/config-loader"
import { generateCodexConfig } from "../config/codex-config-writer"
import type { OhMyCodexConfig } from "../config/schema/oh-my-codex-config"
import { HookRegistry } from "../event-hooks/hook-registry"
import { registerAllHooks } from "../event-hooks/register-all-hooks"
import { generateInstructions } from "../instructions/agents-md-generator"
import { generateRulesFiles } from "../instructions/rules-generator"
import { CodexWrapper } from "./codex-wrapper"
import { EventLoop } from "./event-loop"
import { ThreadPool } from "./thread-pool"

const DEFAULT_AGENT_NAME = "sisyphus"
const MAX_CONTINUATION_ITERATIONS = 20

export type OrchestratorContext = {
  config: OhMyCodexConfig
  wrapper: CodexWrapper
  eventLoop: EventLoop
  threadPool: ThreadPool
  hookRegistry: HookRegistry
  workingDirectory: string
}

type CreateOrchestratorArgs = {
  workingDirectory: string
  agentName?: string
}

type SessionStream = Awaited<ReturnType<CodexWrapper["startSession"]>>

function resolveAgentName(config: OhMyCodexConfig, preferred?: string): string {
  return preferred ?? config.default_agent ?? DEFAULT_AGENT_NAME
}

async function writeCodexConfig(
  config: OhMyCodexConfig,
  workingDirectory: string,
): Promise<void> {
  const codexDir = path.join(workingDirectory, ".codex")
  const configPath = path.join(codexDir, "config.toml")
  await mkdir(codexDir, { recursive: true })
  await writeFile(configPath, generateCodexConfig(config, workingDirectory), "utf-8")
}

export async function createOrchestrator(
  args: CreateOrchestratorArgs,
): Promise<OrchestratorContext> {
  const config = loadConfig(args.workingDirectory)
  await writeCodexConfig(config, args.workingDirectory)
  await generateRulesFiles(config, args.workingDirectory)

  const agentName = resolveAgentName(config, args.agentName)
  const instructions = generateInstructions(agentName, config)

  const hookRegistry = new HookRegistry(config.disabled_hooks ?? [])
  const wrapper = new CodexWrapper({
    config,
    instructions,
    workingDirectory: args.workingDirectory,
    agentName,
  })

  const threadPool = new ThreadPool({
    maxConcurrent: config.background_task?.max_concurrent ?? 5,
  })
  threadPool.setCodexWrapper(wrapper)
  threadPool.setHookRegistry(hookRegistry)

  const eventLoop = new EventLoop(hookRegistry)
  registerAllHooks(hookRegistry, config, args.workingDirectory)

  return {
    config,
    wrapper,
    eventLoop,
    threadPool,
    hookRegistry,
    workingDirectory: args.workingDirectory,
  }
}

function hasContinuationPrompt(continuationPrompt: string | undefined): continuationPrompt is string {
  return typeof continuationPrompt === "string" && continuationPrompt.trim().length > 0
}

export async function runSession(
  ctx: OrchestratorContext,
  input: string,
): Promise<void> {
  let stream: SessionStream = await ctx.wrapper.startSession(input)

  for (let iteration = 0; iteration < MAX_CONTINUATION_ITERATIONS; iteration += 1) {
    await ctx.eventLoop.processStream(stream)

    const continuation = await ctx.hookRegistry.checkContinuation({
      usage: null,
    })
    if (!continuation.shouldContinue) {
      return
    }
    if (!hasContinuationPrompt(continuation.continuationPrompt)) {
      return
    }

    stream = await ctx.wrapper.continueTurn(continuation.continuationPrompt)
  }
}
