import { describe, expect, it } from "bun:test"
import { CommanderError } from "commander"
import { createCliProgram } from "../../cli/cli-program"

async function parseCli(args: string[]): Promise<{ out: string; err: string; error: unknown }> {
  const stdout: string[] = []
  const stderr: string[] = []
  const program = createCliProgram()
  program.exitOverride()
  program.configureOutput({
    writeOut: (message) => stdout.push(message),
    writeErr: (message) => stderr.push(message),
  })

  try {
    await program.parseAsync(args, { from: "user" })
    return { out: stdout.join(""), err: stderr.join(""), error: null }
  } catch (error) {
    return { out: stdout.join(""), err: stderr.join(""), error }
  }
}

describe("integration/cli", () => {
  it("prints help output with expected commands", async () => {
    const result = await parseCli(["--help"])
    const error = result.error as CommanderError

    expect(error.code).toBe("commander.helpDisplayed")
    expect(result.out.includes("Usage:")).toBe(true)
    expect(result.out.includes("mcp-server")).toBe(true)
    expect(result.out.includes("migrate")).toBe(true)
  })

  it("handles --version flag as unknown option", async () => {
    const result = await parseCli(["--version"])
    const error = result.error as CommanderError

    expect(error.code).toBe("commander.unknownOption")
    expect(result.err.includes("unknown option '--version'")).toBe(true)
  })

  it("includes mcp-server subcommand", () => {
    const program = createCliProgram()
    const commandNames = program.commands.map((command) => command.name())

    expect(commandNames).toContain("mcp-server")
  })

  it("rejects unknown option flags", async () => {
    const result = await parseCli(["--nonexistent-flag"])
    const error = result.error as CommanderError

    expect(error.code).toBe("commander.unknownOption")
    expect(result.err.includes("unknown option")).toBe(true)
  })
})
