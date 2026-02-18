import pc from "picocolors"
import { runCli } from "./cli-program"

async function main(): Promise<void> {
  await runCli(process.argv)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(pc.red(`CLI failed: ${message}`))
  process.exitCode = 1
})
