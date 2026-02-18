import { basename, dirname, join } from "node:path"
import { readdir, readFile } from "node:fs/promises"
import type { SkillContent } from "./types"

interface ParsedFrontmatter {
  name?: string
  description?: string
  allowedTools?: string[]
}

function parseFrontmatterBlock(raw: string): ParsedFrontmatter {
  const parsed: ParsedFrontmatter = {}
  const lines = raw.split(/\r?\n/)

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (line.length === 0 || line.startsWith("#")) {
      continue
    }

    const keyValue = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/)
    if (!keyValue) {
      continue
    }

    const [, rawKey, rawValue] = keyValue
    const key = rawKey.toLowerCase()
    const value = rawValue.trim().replace(/^['"]|['"]$/g, "")

    if (key === "name") {
      parsed.name = value
      continue
    }

    if (key === "description") {
      parsed.description = value
      continue
    }

    if (key === "allowed_tools" || key === "allowedtools") {
      const allowedTools: string[] = []
      if (value.length > 0) {
        const normalized = value.replace(/^\[|\]$/g, "")
        for (const item of normalized.split(",")) {
          const trimmed = item.trim().replace(/^['"]|['"]$/g, "")
          if (trimmed.length > 0) {
            allowedTools.push(trimmed)
          }
        }
      }

      for (let next = index + 1; next < lines.length; next += 1) {
        const listItem = lines[next].match(/^\s*-\s+(.+)$/)
        if (!listItem) {
          break
        }
        allowedTools.push(listItem[1].trim().replace(/^['"]|['"]$/g, ""))
        index = next
      }

      parsed.allowedTools = Array.from(new Set(allowedTools))
    }
  }

  return parsed
}

function splitFrontmatter(content: string): { frontmatter: ParsedFrontmatter; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {}, body: content }
  }

  return {
    frontmatter: parseFrontmatterBlock(match[1]),
    body: match[2],
  }
}

async function collectSkillFiles(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const entryPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectSkillFiles(entryPath)))
      continue
    }
    if (entry.isFile() && entry.name === "SKILL.md") {
      files.push(entryPath)
    }
  }

  return files
}

export async function parseSkillFile(filePath: string): Promise<SkillContent> {
  const raw = await readFile(filePath, "utf8")
  const { frontmatter, body } = splitFrontmatter(raw)
  return {
    name: frontmatter.name ?? basename(dirname(filePath)),
    description: frontmatter.description ?? "",
    content: body.trim(),
    allowedTools: frontmatter.allowedTools,
  }
}

export async function scanSkillDirectory(workingDir: string): Promise<SkillContent[]> {
  const root = join(workingDir, ".codex", "skills")

  try {
    const files = await collectSkillFiles(root)
    const loaded = await Promise.all(files.map((filePath) => parseSkillFile(filePath)))
    return loaded.sort((left, right) => left.name.localeCompare(right.name))
  } catch {
    return []
  }
}
