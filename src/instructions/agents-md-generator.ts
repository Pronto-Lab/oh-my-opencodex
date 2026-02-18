import type { OhMyCodexConfig } from "../config/schema/oh-my-codex-config"
import {
  buildCategorySection,
  buildDelegationSection,
  buildToolGuidanceSection,
} from "./dynamic-prompt-builder"
import { getAgentPrompt } from "./agent-prompts"

const MAX_INSTRUCTIONS_BYTES = 32768
const TRUNCATION_WARNING = "\n\n[WARNING] Instructions exceeded 32768 bytes and were truncated."

function fallbackCoreInstructions(agentName: string): string {
  return `You are ${agentName}, an oh-my-codex agent. Execute tasks with evidence-based verification.`
}

function truncateToLimit(input: string): string {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(input)
  if (bytes.length <= MAX_INSTRUCTIONS_BYTES) return input

  const warningBytes = encoder.encode(TRUNCATION_WARNING)
  const available = Math.max(0, MAX_INSTRUCTIONS_BYTES - warningBytes.length)
  const sliced = bytes.slice(0, available)
  const prefix = new TextDecoder().decode(sliced)
  return `${prefix}${TRUNCATION_WARNING}`
}

export function generateInstructions(agentName: string, config: OhMyCodexConfig): string {
  const prompt = getAgentPrompt(agentName)

  const sections = [
    prompt?.coreInstructions ?? fallbackCoreInstructions(agentName),
    prompt?.toolGuidance ?? buildToolGuidanceSection(config),
    prompt?.delegationRules ?? buildDelegationSection(config),
    buildCategorySection(config),
    config.agents?.[agentName]?.prompt_append,
  ]

  const instructions = sections
    .filter((section): section is string => typeof section === "string" && section.trim().length > 0)
    .join("\n\n")

  return truncateToLimit(instructions)
}
