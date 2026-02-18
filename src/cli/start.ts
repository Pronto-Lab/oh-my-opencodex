import { createInterface } from "readline/promises"
import pc from "picocolors"
import { loadConfig } from "../config/config-loader"

export type StartInteractiveOptions = {
  workingDirectory: string
  agentName: string
  verbose: boolean
  initialPrompt?: string
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

export async function startInteractive(options: StartInteractiveOptions): Promise<void> {
  const config = loadConfig(options.workingDirectory)
  const agentName = options.agentName || config.default_agent || "sisyphus"

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  })

  let shuttingDown = false
  const shutdown = (): void => {
    if (shuttingDown) {
      return
    }
    shuttingDown = true
    console.log(pc.yellow("\nInterrupted. Exiting interactive session."))
    readline.close()
  }

  process.once("SIGINT", shutdown)
  console.log(pc.cyan(`Starting interactive session with ${agentName}`))
  console.log(pc.dim(`Working directory: ${options.workingDirectory}`))
  console.log(pc.dim("Type 'exit' or press Ctrl+C to quit."))

  let prompt = options.initialPrompt
  while (!shuttingDown) {
    const input = (prompt ?? (await readline.question(pc.bold("\n> ")))).trim()
    prompt = undefined

    if (!input) {
      continue
    }

    if (input.toLowerCase() === "exit") {
      break
    }

    const context: OrchestratorContext = {
      workingDirectory: options.workingDirectory,
      agentName,
      verbose: options.verbose,
      ultrawork: hasUltraworkKeyword(input),
    }

    if (options.verbose) {
      console.log(pc.dim(`[verbose] ultrawork=${context.ultrawork}`))
    }

    const result = await runOrchestratorTurn(context, input)
    console.log(result.output)
  }

  process.off("SIGINT", shutdown)
  readline.close()
}
