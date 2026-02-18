import { describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { runDoctor } from "./doctor"

function createTempWorkspace(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-test-"))
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relativePath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content, "utf-8")
  }
  return dir
}

function cleanupTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true })
}

function suppressConsole<T>(fn: () => T): { result: T; logs: string[] } {
  const logs: string[] = []
  const originalLog = console.log
  console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "))
  const result = fn()
  console.log = originalLog
  return { result, logs }
}

describe("runDoctor", () => {
  it("prints summary with pass/fail counts", () => {
    const dir = createTempWorkspace({
      "package.json": JSON.stringify({ name: "test", version: "0.1.0" }),
    })

    try {
      const { logs } = suppressConsole(() => runDoctor(dir))
      const summaryLine = logs.find((line) => line.includes("Summary"))
      expect(summaryLine).toBeDefined()
      expect(summaryLine).toContain("passed")
      expect(summaryLine).toContain("failed")
    } finally {
      cleanupTempDir(dir)
    }
  })

  it("reports missing config.toml as failure", () => {
    const dir = createTempWorkspace({
      ".codex/oh-my-opencodex.jsonc": "{}",
      "package.json": JSON.stringify({ name: "test", version: "0.1.0" }),
    })

    try {
      const { result, logs } = suppressConsole(() => runDoctor(dir))
      expect(result).toBe(1)
      expect(logs.some((line) => line.includes("config.toml") && line.includes("missing"))).toBe(true)
    } finally {
      cleanupTempDir(dir)
    }
  })

  it("reports missing oh-my-opencodex.jsonc as failure", () => {
    const dir = createTempWorkspace({
      ".codex/config.toml": [
        'model = "gpt-5.3-codex"',
        "[permissions]",
        "[mcp_servers.oh-my-opencodex]",
      ].join("\n"),
      "package.json": JSON.stringify({ name: "test", version: "0.1.0" }),
    })

    try {
      const { result, logs } = suppressConsole(() => runDoctor(dir))
      expect(result).toBe(1)
      expect(logs.some((line) => line.includes("oh-my-opencodex.jsonc") && line.includes("missing"))).toBe(true)
    } finally {
      cleanupTempDir(dir)
    }
  })

  it("detects invalid config.toml content", () => {
    const dir = createTempWorkspace({
      ".codex/config.toml": "this is not valid codex toml",
      ".codex/oh-my-opencodex.jsonc": "{}",
      "package.json": JSON.stringify({ name: "test", version: "0.1.0" }),
    })

    try {
      const { result, logs } = suppressConsole(() => runDoctor(dir))
      expect(result).toBe(1)
      expect(logs.some((line) => line.includes("invalid") || line.includes("appears"))).toBe(true)
    } finally {
      cleanupTempDir(dir)
    }
  })

  it("validates valid config.toml content", () => {
    const dir = createTempWorkspace({
      ".codex/config.toml": [
        'model = "gpt-5.3-codex"',
        "",
        "[permissions]",
        'approval_policy = "on-request"',
        "",
        "[mcp_servers.oh-my-opencodex]",
        'command = "oh-my-opencodex"',
      ].join("\n"),
      ".codex/oh-my-opencodex.jsonc": "{}",
      "package.json": JSON.stringify({ name: "test", version: "0.1.0" }),
    })

    try {
      const { logs } = suppressConsole(() => runDoctor(dir))
      expect(logs.some((line) => line.includes("config.toml") && line.includes("valid"))).toBe(true)
    } finally {
      cleanupTempDir(dir)
    }
  })

  it("reports runtime version info", () => {
    const dir = createTempWorkspace({
      "package.json": JSON.stringify({ name: "test", version: "0.1.0" }),
    })

    try {
      const { logs } = suppressConsole(() => runDoctor(dir))
      expect(logs.some((line) => line.includes("Node.js"))).toBe(true)
    } finally {
      cleanupTempDir(dir)
    }
  })
})
