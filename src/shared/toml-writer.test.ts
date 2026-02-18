import { describe, expect, it } from "bun:test"
import { toToml } from "./toml-writer"

describe("toToml", () => {
  it("serializes primitives and arrays", () => {
    const toml = toToml({
      stringValue: "hello",
      numberValue: 42,
      boolValue: true,
      list: ["one", "two", 3],
    })

    expect(toml).toContain('stringValue = "hello"')
    expect(toml).toContain("numberValue = 42")
    expect(toml).toContain("boolValue = true")
    expect(toml).toContain('list = ["one", "two", 3]')
  })

  it("escapes special characters in strings", () => {
    const toml = toToml({
      quoted: 'say "hello"',
      slashes: "path\\to\\file",
      newline: "line1\nline2",
    })

    expect(toml).toContain('quoted = "say \\"hello\\""')
    expect(toml).toContain('slashes = "path\\\\to\\\\file"')
    expect(toml).toContain('newline = "line1\\nline2"')
  })

  it("writes nested object sections and skips nullish values", () => {
    const toml = toToml({
      included: "yes",
      skippedNull: null,
      skippedUndefined: undefined,
      nested: {
        enabled: true,
        args: ["a", "b"],
      },
    })

    expect(toml).toContain('included = "yes"')
    expect(toml).not.toContain("skippedNull")
    expect(toml).not.toContain("skippedUndefined")
    expect(toml).toContain("[nested]")
    expect(toml).toContain("enabled = true")
    expect(toml).toContain('args = ["a", "b"]')
  })
})
