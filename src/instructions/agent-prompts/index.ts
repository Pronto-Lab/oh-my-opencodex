import * as atlasModule from "./atlas"
import * as exploreModule from "./explore"
import * as hephaestusModule from "./hephaestus"
import * as librarianModule from "./librarian"
import * as oracleModule from "./oracle"
import * as sisyphusModule from "./sisyphus"

export type AgentPromptDefinition = {
  coreInstructions: string
  toolGuidance?: string
  delegationRules?: string
}

const MODULE_BY_AGENT: Record<string, Record<string, unknown>> = {
  atlas: atlasModule,
  explore: exploreModule,
  hephaestus: hephaestusModule,
  librarian: librarianModule,
  oracle: oracleModule,
  sisyphus: sisyphusModule,
}

function pickPrompt(moduleExports: Record<string, unknown>): AgentPromptDefinition | null {
  for (const value of Object.values(moduleExports)) {
    if (!value || typeof value !== "object") continue
    const candidate = value as Partial<AgentPromptDefinition>
    if (typeof candidate.coreInstructions !== "string") continue
    return {
      coreInstructions: candidate.coreInstructions,
      toolGuidance: typeof candidate.toolGuidance === "string" ? candidate.toolGuidance : undefined,
      delegationRules: typeof candidate.delegationRules === "string" ? candidate.delegationRules : undefined,
    }
  }
  return null
}

export function getAgentPrompt(agentName: string): AgentPromptDefinition | null {
  const moduleExports = MODULE_BY_AGENT[agentName]
  if (!moduleExports) return null
  return pickPrompt(moduleExports)
}
