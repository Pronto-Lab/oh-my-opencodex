import * as path from "path"
import { Command } from "commander"
import pc from "picocolors"
import { autoMigrate, detectLegacyConfig } from "../config/migration"
import { runMcpServerCommand } from "./mcp-server-command"
import { runNonInteractive } from "./run"
import { startInteractive } from "./start"

type CliGlobalOptions = {
  dir?: string
  agent?: string
  verbose?: boolean
}

function addGlobalOptions(command: Command): Command {
  return command
    .option("--dir <path>", "working directory", process.cwd())
    .option("--agent <name>", "agent name", "sisyphus")
    .option("--verbose", "verbose logging", false)
}

function resolveGlobalOptions(options: CliGlobalOptions): Required<CliGlobalOptions> {
  return {
    dir: path.resolve(options.dir ?? process.cwd()),
    agent: options.agent ?? "sisyphus",
    verbose: Boolean(options.verbose),
  }
}

export function createCliProgram(): Command {
  const program = addGlobalOptions(new Command())

  program
    .name("oh-my-opencodex")
    .description("Oh My Codex CLI")
    .argument("[prompt]", "initial prompt for interactive mode")
    .action(async (prompt: string | undefined, options: CliGlobalOptions) => {
      const globals = resolveGlobalOptions(options)
      await startInteractive({
        workingDirectory: globals.dir,
        agentName: globals.agent,
        verbose: globals.verbose,
        initialPrompt: prompt,
      })
    })

  addGlobalOptions(program.command("exec <prompt>", { isDefault: false }))
    .description("Run a single non-interactive turn")
    .action(async (prompt: string, options: CliGlobalOptions) => {
      const globals = resolveGlobalOptions(options)
      const exitCode = await runNonInteractive({
        prompt,
        workingDirectory: globals.dir,
        agentName: globals.agent,
        verbose: globals.verbose,
      })

      if (exitCode !== 0) {
        process.exitCode = exitCode
      }
    })

  addGlobalOptions(program.command("mcp-server"))
    .description("Start MCP server mode")
    .action(async (options: CliGlobalOptions) => {
      const globals = resolveGlobalOptions(options)
      await runMcpServerCommand({ dir: globals.dir })
    })

  addGlobalOptions(program.command("install"))
    .description("Run setup wizard")
    .action(async (options: CliGlobalOptions) => {
      const globals = resolveGlobalOptions(options)
      const { runInstallWizard } = await import("./install")
      const exitCode = await runInstallWizard(globals.dir)
      if (exitCode !== 0) {
        process.exitCode = exitCode
      }
    })

  addGlobalOptions(program.command("doctor"))
    .description("Run health checks")
    .action(async (options: CliGlobalOptions) => {
      const globals = resolveGlobalOptions(options)
      const { runDoctor } = await import("./doctor")
      const exitCode = runDoctor(globals.dir)
      if (exitCode !== 0) {
        process.exitCode = exitCode
      }
    })

  addGlobalOptions(program.command("migrate"))
    .description("Migrate legacy oh-my-opencodex config")
    .action((options: CliGlobalOptions) => {
      const globals = resolveGlobalOptions(options)
      if (!detectLegacyConfig(globals.dir)) {
        console.log(pc.green("No legacy config found."))
        return
      }

      const result = autoMigrate(globals.dir)
      if (!result.migrated) {
        console.log(pc.red("Legacy config detected, but migration failed."))
        process.exitCode = 1
        return
      }

      for (const change of result.changes) {
        console.log(pc.green(change))
      }
    })

  return program
}

export async function runCli(argv: string[]): Promise<void> {
  const program = createCliProgram()
  await program.parseAsync(argv)
}
