import { describe, expect, it } from "bun:test"
import { readFile } from "node:fs/promises"
import os from "node:os"
import { getLogFilePath, log } from "./logger"

describe("logger", () => {
  it("returns a log path in the temp directory", () => {
    const logPath = getLogFilePath()
    expect(logPath.startsWith(os.tmpdir())).toBe(true)
    expect(logPath.endsWith("oh-my-opencodex.log")).toBe(true)
  })

  it("appends a formatted log entry to the log file", async () => {
    const logPath = getLogFilePath()
    const marker = `logger-test-${Date.now()}`

    log("unit-test-message", { marker })

    const content = await readFile(logPath, "utf-8")
    expect(content).toContain("unit-test-message")
    expect(content).toContain(marker)
  })
})
