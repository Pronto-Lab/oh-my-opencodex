import * as fs from "node:fs"
import * as path from "node:path"
import * as p from "@clack/prompts"
import color from "picocolors"
import { generateCodexConfig } from "../config/codex-config-writer"
import type { OhMyCodexConfig } from "../config/schema"

const CODEX_DIR = ".codex"
const OMO_CONFIG_FILE = "oh-my-codex.jsonc"
const CODEX_CONFIG_FILE = "config.toml"

export async function runInstallWizard(workingDirectory: string = process.cwd()): Promise<number> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error("Interactive setup requires a TTY")
    return 1
  }

  p.intro("Welcome to oh-my-codex setup")

  const existingApiKey = process.env.OPENAI_API_KEY
  const apiKey = existingApiKey || await promptApiKey()
  if (!apiKey) {
    p.outro(color.red("Setup cancelled"))
    return 1
  }

  if (!existingApiKey) {
    const saveToProfile = await p.confirm({
      message: "Save OPENAI_API_KEY to your shell profile?",
      initialValue: true,
    })
    if (p.isCancel(saveToProfile)) {
      p.outro(color.red("Setup cancelled"))
      return 1
    }

    if (saveToProfile) {
      await appendEnvToShellProfile(apiKey)
    }
  }

  const codexDirectory = path.join(workingDirectory, CODEX_DIR)
  const skillsDirectory = path.join(codexDirectory, "skills")
  fs.mkdirSync(skillsDirectory, { recursive: true })

  const omoConfigPath = path.join(codexDirectory, OMO_CONFIG_FILE)
  const defaultConfig = createDefaultConfig()
  fs.writeFileSync(omoConfigPath, formatJsonc(defaultConfig), "utf-8")

  const codexConfigPath = path.join(codexDirectory, CODEX_CONFIG_FILE)
  const toml = generateCodexConfig(defaultConfig, workingDirectory)
  fs.writeFileSync(codexConfigPath, toml, "utf-8")

  p.outro(
    [
      color.green("Setup complete."),
      `Generated ${color.cyan(path.relative(workingDirectory, omoConfigPath))}`,
      `Generated ${color.cyan(path.relative(workingDirectory, codexConfigPath))}`,
      `Created ${color.cyan(path.relative(workingDirectory, skillsDirectory))}`,
      "Run 'codex' to start",
    ].join("\n"),
  )

  return 0
}

function createDefaultConfig(): OhMyCodexConfig {
  return {
    approval_policy: "on-request",
    sandbox_mode: "workspace-write",
    web_search_mode: "cached",
    skills: {
      paths: [".codex/skills"],
      recursive: true,
    },
  }
}

async function promptApiKey(): Promise<string | null> {
  const entered = await p.password({
    message: "OPENAI_API_KEY not found. Enter it now",
    validate: (value) => (value.trim().length > 0 ? undefined : "API key is required"),
  })

  if (p.isCancel(entered)) {
    return null
  }

  return entered.trim()
}

async function appendEnvToShellProfile(apiKey: string): Promise<void> {
  const profilePath = detectShellProfilePath()
  if (!profilePath) {
    p.log.warn("Could not detect shell profile. Add OPENAI_API_KEY manually.")
    return
  }

  const exportLine = `export OPENAI_API_KEY=\"${escapeDoubleQuotes(apiKey)}\"`
  if (!fs.existsSync(profilePath)) {
    fs.writeFileSync(profilePath, `${exportLine}\n`, "utf-8")
    p.log.success(`Saved OPENAI_API_KEY to ${profilePath}`)
    return
  }

  const content = fs.readFileSync(profilePath, "utf-8")
  if (content.includes("OPENAI_API_KEY")) {
    p.log.warn(`${profilePath} already contains OPENAI_API_KEY. Skipped append.`)
    return
  }

  const suffix = content.endsWith("\n") ? "" : "\n"
  fs.writeFileSync(profilePath, `${content}${suffix}${exportLine}\n`, "utf-8")
  p.log.success(`Saved OPENAI_API_KEY to ${profilePath}`)
}

function detectShellProfilePath(): string | null {
  const home = process.env.HOME
  if (!home) {
    return null
  }

  const shell = process.env.SHELL ?? ""
  if (shell.includes("zsh")) {
    return path.join(home, ".zshrc")
  }
  if (shell.includes("bash")) {
    return path.join(home, ".bashrc")
  }
  return null
}

function escapeDoubleQuotes(value: string): string {
  return value.replaceAll('"', '\\"')
}

function formatJsonc(config: OhMyCodexConfig): string {
  const banner = [
    "{",
    "  // oh-my-codex project configuration",
    ...toIndentedJsonLines(config),
    "}",
  ]
  return banner.join("\n")
}

function toIndentedJsonLines(config: OhMyCodexConfig): string[] {
  const json = JSON.stringify(config, null, 2)
  const lines = json.split("\n")
  return lines.slice(1, -1).map((line) => `  ${line}`)
}
