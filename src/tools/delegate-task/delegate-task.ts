import type { OhMyCodexConfig } from "../../config/schema/oh-my-codex-config"
import type { ThreadPool } from "../../orchestrator/thread-pool"
import { resolveCategory } from "./category-resolver"
import { resolveSkills } from "./skill-resolver"
import type { DelegateTaskArgs } from "./types"

const SUBAGENT_MODEL_MAP: Record<string, string> = {
  sisyphus: "gpt-5.3-codex",
  hephaestus: "gpt-5.3-codex",
  oracle: "gpt-5.2",
  atlas: "gpt-5.1",
  explore: "gpt-5-nano",
  librarian: "gpt-5.1",
  "sisyphus-junior": "gpt-5.3-codex",
  "visual-engineer": "gpt-5.1",
}

const POLL_INTERVAL_MS = 250
const POLL_TIMEOUT_MS = 5 * 60 * 1000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function resolveModel(args: DelegateTaskArgs, config: OhMyCodexConfig): { model: string; reason: string } {
  if (args.subagentType) {
    const mapped = SUBAGENT_MODEL_MAP[args.subagentType]
    if (mapped) {
      return { model: mapped, reason: `subagent:${args.subagentType}` }
    }
  }

  if (args.category) {
    const category = resolveCategory(args.category, config)
    return {
      model: category.model,
      reason: `category:${args.category} (${category.reasoningEffort})`,
    }
  }

  return { model: "gpt-5.1", reason: "default" }
}

function buildPrompt(args: DelegateTaskArgs, skillInstructions: string[]): string {
  const promptParts: string[] = []

  if (args.command) {
    promptParts.push(`Command context: ${args.command}`)
  }
  if (args.sessionId) {
    promptParts.push(`Session context: continue session ${args.sessionId}`)
  }

  promptParts.push(args.prompt)

  if (skillInstructions.length > 0) {
    promptParts.push("Skill instructions:")
    for (const skillInstruction of skillInstructions) {
      promptParts.push(skillInstruction)
    }
  }

  return promptParts.join("\n\n")
}

async function waitForTaskCompletion(pool: ThreadPool, taskId: string): Promise<string> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const task = pool.getTask(taskId)
    if (!task) {
      await sleep(POLL_INTERVAL_MS)
      continue
    }

    if (task.status === "completed") {
      return task.result ?? ""
    }
    if (task.status === "failed") {
      throw new Error(task.error ?? `Task ${taskId} failed`)
    }
    if (task.status === "cancelled") {
      throw new Error(`Task ${taskId} was cancelled`)
    }

    await sleep(POLL_INTERVAL_MS)
  }

  throw new Error(`Task ${taskId} timed out after ${POLL_TIMEOUT_MS}ms`)
}

export async function delegateTask(
  pool: ThreadPool,
  config: OhMyCodexConfig,
  workingDir: string,
  args: DelegateTaskArgs,
): Promise<string> {
  const skills = await resolveSkills(args.skills ?? [], workingDir)
  const fullPrompt = buildPrompt(args, skills)
  const modelResolution = resolveModel(args, config)

  const taskId = pool.spawn({
    prompt: fullPrompt,
    model: modelResolution.model,
    title: args.description,
    description: args.prompt,
  })

  if (args.runInBackground) {
    const sessionInfo = args.sessionId ? `\nsession_id: ${args.sessionId}` : ""
    return [
      `Task started in background.`,
      `task_id: ${taskId}`,
      `model: ${modelResolution.model}`,
      `selection: ${modelResolution.reason}${sessionInfo}`,
    ].join("\n")
  }

  const result = await waitForTaskCompletion(pool, taskId)
  return [
    `Task completed.`,
    `task_id: ${taskId}`,
    `model: ${modelResolution.model}`,
    `selection: ${modelResolution.reason}`,
    "",
    result,
  ].join("\n")
}
