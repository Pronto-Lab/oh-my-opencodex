import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { load as parseYaml } from "js-yaml"

type ParsedSkill = {
  names: string[]
  content: string
}

async function findSkillMarkdownFiles(rootDirectory: string): Promise<string[]> {
  const discovered: string[] = []

  async function walk(currentDirectory: string): Promise<void> {
    const entries = await readdir(currentDirectory, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentDirectory, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }
      if (entry.isFile() && entry.name === "SKILL.md") {
        discovered.push(fullPath)
      }
    }
  }

  try {
    await walk(rootDirectory)
  } catch (error) {
    const isMissingDirectory = error instanceof Error
      && "code" in error
      && error.code === "ENOENT"
    if (isMissingDirectory) {
      return []
    }
    throw error
  }
  return discovered
}

function parseSkillFile(filePath: string, raw: string, rootDirectory: string): ParsedSkill {
  const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  const frontmatter = frontmatterMatch ? parseYaml(frontmatterMatch[1]) : undefined
  const content = frontmatterMatch ? frontmatterMatch[2].trim() : raw.trim()

  const relativeDirectory = path.dirname(path.relative(rootDirectory, filePath))
  const normalizedRelativeDirectory = relativeDirectory.split(path.sep).join("/")
  const baseName = path.basename(path.dirname(filePath))

  const names = new Set<string>([normalizedRelativeDirectory, baseName])
  if (frontmatter && typeof frontmatter === "object" && "name" in frontmatter) {
    const name = (frontmatter as { name?: unknown }).name
    if (typeof name === "string" && name.trim().length > 0) {
      names.add(name.trim())
    }
  }

  return { names: Array.from(names).filter((name) => name.length > 0), content }
}

export async function resolveSkills(skillNames: string[], workingDir: string): Promise<string[]> {
  const requestedSkills = Array.from(new Set(skillNames.map((skill) => skill.trim()).filter(Boolean)))
  if (requestedSkills.length === 0) {
    return []
  }

  const skillsRoot = path.join(workingDir, ".codex", "skills")
  const skillPaths = await findSkillMarkdownFiles(skillsRoot)
  const skillContents = new Map<string, string>()

  for (const skillPath of skillPaths) {
    const raw = await readFile(skillPath, "utf8")
    const parsed = parseSkillFile(skillPath, raw, skillsRoot)
    for (const name of parsed.names) {
      skillContents.set(name, parsed.content)
    }
  }

  const resolved: string[] = []
  const missing: string[] = []
  for (const requested of requestedSkills) {
    const content = skillContents.get(requested)
    if (!content) {
      missing.push(requested)
      continue
    }
    resolved.push(content)
  }

  if (missing.length > 0) {
    throw new Error(`Skills not found: ${missing.join(", ")}`)
  }

  return resolved
}
