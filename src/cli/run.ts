import pc from "picocolors"
import { loadConfig } from "../config/config-loader"

export type RunNonInteractiveOptions = {
  prompt: string
  workingDirectory: string
  agentName: string
  verbose: boolean
}

type OrchestratorContext = {
  workingDirectory: string
  agentName: string
  verbose: boolean
  ultrawork: boolean
}

type TurnResult = {
  output: string
}

function hasUltraworkKeyword(input: string): boolean {
  return /\b(ultrawork|ulw)\b/i.test(input)
}

async function runOrchestratorTurn(
  context: OrchestratorContext,
  input: string,
): Promise<TurnResult> {
  // TODO: wire real orchestrator once src/orchestrator/orchestrator.ts is implemented.
  const mode = context.ultrawork ? "ultrawork" : "standard"
  return {
    output: `[stub:${context.agentName}/${mode}] ${input}`,
  }
}

export async function runNonInteractive(options: RunNonInteractiveOptions): Promise<number> {
  try {
    const config = loadConfig(options.workingDirectory)
    const agentName = options.agentName || config.default_agent || "sisyphus"
    const context: OrchestratorContext = {
      workingDirectory: options.workingDirectory,
      agentName,
      verbose: options.verbose,
      ultrawork: hasUltraworkKeyword(options.prompt),
    }

    if (options.verbose) {
      console.log(pc.dim(`[verbose] running with ${agentName}`))
    }

    const result = await runOrchestratorTurn(context, options.prompt)
    console.log(result.output)
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(pc.red(`Run failed: ${message}`))
    return 1
  }
}
