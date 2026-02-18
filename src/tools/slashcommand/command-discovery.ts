import { join, relative } from "node:path"
import { readdir, readFile } from "node:fs/promises"
import type { CommandTemplate } from "./types"

interface FrontmatterData {
  description?: string
}

function parseFrontmatter(content: string): { data: FrontmatterData; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    return { data: {}, body: content }
  }

  const data: FrontmatterData = {}
  for (const line of match[1].split(/\r?\n/)) {
    const keyValue = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/)
    if (!keyValue) {
      continue
    }
    const key = keyValue[1].toLowerCase()
    const value = keyValue[2].trim().replace(/^['"]|['"]$/g, "")
    if (key === "description") {
      data.description = value
    }
  }

  return { data, body: match[2] }
}

async function collectMarkdownFiles(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const entryPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(entryPath)))
      continue
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(entryPath)
    }
  }

  return files
}

function commandNameFromPath(root: string, path: string): string {
  return relative(root, path).replace(/\\/g, "/").replace(/\.md$/i, "")
}

export async function scanCommandDirectory(workingDir: string): Promise<CommandTemplate[]> {
  const root = join(workingDir, ".codex", "commands")

  try {
    const files = await collectMarkdownFiles(root)
    const commands = await Promise.all(
      files.map(async (path) => {
        const raw = await readFile(path, "utf8")
        const { data, body } = parseFrontmatter(raw)
        const name = commandNameFromPath(root, path)
        return {
          name,
          description: data.description ?? "",
          content: body.trim(),
          path,
        }
      })
    )

    return commands.sort((left, right) => left.name.localeCompare(right.name))
  } catch {
    return []
  }
}
