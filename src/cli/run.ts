import pc from "picocolors"
import { createOrchestrator, runSession } from "../orchestrator/orchestrator"

export type RunNonInteractiveOptions = {
  prompt: string
  workingDirectory: string
  agentName: string
  verbose: boolean
}

export async function runNonInteractive(options: RunNonInteractiveOptions): Promise<number> {
  try {
    const context = await createOrchestrator({
      workingDirectory: options.workingDirectory,
      agentName: options.agentName,
    })

    await runSession(context, options.prompt)
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(pc.red(`Run failed: ${message}`))
    return 1
  }
}
