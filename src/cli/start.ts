import { createInterface } from "readline/promises"
import pc from "picocolors"
import { createOrchestrator, runSession, type OrchestratorContext } from "../orchestrator/orchestrator"

export type StartInteractiveOptions = {
  workingDirectory: string
  agentName: string
  verbose: boolean
  initialPrompt?: string
}

export async function startInteractive(options: StartInteractiveOptions): Promise<void> {
  let context: OrchestratorContext
  try {
    context = await createOrchestrator({
      workingDirectory: options.workingDirectory,
      agentName: options.agentName,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(pc.red(`Failed to initialize: ${message}`))
    return
  }

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  })

  let shuttingDown = false
  const shutdown = (): void => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(pc.yellow("\nInterrupted. Exiting."))
    readline.close()
  }

  process.once("SIGINT", shutdown)
  console.log(pc.cyan(`Started session with ${options.agentName}`))
  console.log(pc.dim(`Working directory: ${options.workingDirectory}`))

  let prompt = options.initialPrompt
  while (!shuttingDown) {
    const input = (prompt ?? (await readline.question(pc.bold("\n> ")))).trim()
    prompt = undefined

    if (!input || input.toLowerCase() === "exit") break

    try {
      await runSession(context, input)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(pc.red(`Turn failed: ${message}`))
    }
  }

  process.off("SIGINT", shutdown)
  readline.close()
}
