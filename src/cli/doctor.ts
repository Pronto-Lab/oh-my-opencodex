import * as fs from "node:fs"
import * as path from "node:path"
import { execSync } from "node:child_process"
import color from "picocolors"
import { parseJsonc } from "../shared/jsonc-parser"
import { OhMyCodexConfigSchema } from "../config/schema/oh-my-codex-config"

type CheckResult = {
  ok: boolean
  critical: boolean
  message: string
}

export function runDoctor(workingDirectory: string = process.cwd()): number {
  const checks = [
    openAiKeyCheck(),
    codexBinaryCheck(),
    codexTomlCheck(workingDirectory),
    omoJsoncCheck(workingDirectory),
    runtimeVersionCheck(),
    packageVersionCheck(workingDirectory),
  ]

  for (const check of checks) {
    const symbol = check.ok ? color.green("✓") : color.red("✗")
    const text = check.ok ? check.message : color.red(check.message)
    console.log(`${symbol} ${text}`)
  }

  const passed = checks.filter((check) => check.ok).length
  const failed = checks.length - passed
  console.log()
  console.log(`${color.bold("Summary:")} ${passed} passed, ${failed} failed`)

  const hasCriticalFailure = checks.some((check) => check.critical && !check.ok)
  return hasCriticalFailure ? 1 : 0
}

function openAiKeyCheck(): CheckResult {
  const key = process.env.OPENAI_API_KEY
  if (key && key.trim().length > 0) {
    return ok("OPENAI_API_KEY is set")
  }
  return fail("OPENAI_API_KEY is missing")
}

function codexBinaryCheck(): CheckResult {
  const resolved = runCommand("command -v codex")
  if (resolved.ok && resolved.output.length > 0) {
    return ok(`codex binary found at ${resolved.output}`)
  }
  return fail("codex binary not found")
}

function codexTomlCheck(workingDirectory: string): CheckResult {
  const configPath = path.join(workingDirectory, ".codex/config.toml")
  if (!fs.existsSync(configPath)) {
    return fail(".codex/config.toml is missing")
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8")
    if (!looksLikeValidCodexToml(content)) {
      return fail(".codex/config.toml exists but appears invalid")
    }
    return ok(".codex/config.toml exists and appears valid")
  } catch (error) {
    return fail(`failed reading .codex/config.toml: ${toErrorMessage(error)}`)
  }
}

function omoJsoncCheck(workingDirectory: string): CheckResult {
  const configPath = path.join(workingDirectory, ".codex/oh-my-codex.jsonc")
  if (!fs.existsSync(configPath)) {
    return fail(".codex/oh-my-codex.jsonc is missing")
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8")
    const parsed = parseJsonc<unknown>(content)
    const result = OhMyCodexConfigSchema.safeParse(parsed)
    if (!result.success) {
      return fail(".codex/oh-my-codex.jsonc exists but failed schema validation")
    }
    return ok(".codex/oh-my-codex.jsonc exists and is valid")
  } catch (error) {
    return fail(`failed reading .codex/oh-my-codex.jsonc: ${toErrorMessage(error)}`)
  }
}

function runtimeVersionCheck(): CheckResult {
  const nodeVersion = process.versions.node
  const bunVersion = process.versions.bun
  const nodeMajor = Number.parseInt(nodeVersion.split(".")[0] ?? "0", 10)

  if (!Number.isFinite(nodeMajor) || nodeMajor < 18) {
    return fail(`Node.js ${nodeVersion} detected (requires >= 18)`)
  }

  if (bunVersion) {
    return ok(`Node.js ${nodeVersion}, Bun ${bunVersion}`)
  }

  return ok(`Node.js ${nodeVersion} detected (Bun not detected)`)
}

function packageVersionCheck(workingDirectory: string): CheckResult {
  try {
    const packagePath = path.join(workingDirectory, "package.json")
    const raw = fs.readFileSync(packagePath, "utf-8")
    const parsed = JSON.parse(raw) as { name?: string; version?: string }
    const name = parsed.name ?? "oh-my-codex"
    const version = parsed.version ?? "unknown"
    return ok(`${name} version ${version}`)
  } catch (error) {
    return warn(`could not read oh-my-codex version: ${toErrorMessage(error)}`)
  }
}

function runCommand(command: string): { ok: boolean; output: string } {
  try {
    const output = execSync(command, { stdio: ["ignore", "pipe", "pipe"] })
      .toString()
      .trim()
    return { ok: true, output }
  } catch {
    return { ok: false, output: "" }
  }
}

function looksLikeValidCodexToml(content: string): boolean {
  if (content.trim().length === 0) {
    return false
  }

  const hasModel = /(^|\n)model\s*=\s*".+"/.test(content)
  const hasPermissions = /\[permissions\]/.test(content)
  const hasOmoMcp = /\[mcp_servers\.oh-my-codex\]/.test(content)
  return hasModel && hasPermissions && hasOmoMcp
}

function ok(message: string): CheckResult {
  return { ok: true, critical: false, message }
}

function fail(message: string): CheckResult {
  return { ok: false, critical: true, message }
}

function warn(message: string): CheckResult {
  return { ok: false, critical: false, message }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
