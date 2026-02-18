import { scanSkillDirectory } from "./skill-discovery"

function formatSkillNames(names: string[]): string {
  if (names.length === 0) {
    return "(none found in .codex/skills/)"
  }
  return names.map((name) => `- ${name}`).join("\n")
}

export async function loadSkill(name: string, workingDir: string): Promise<string> {
  const availableSkills = await scanSkillDirectory(workingDir)
  const requested = name.trim().toLowerCase()

  if (requested.length === 0) {
    return `Skill name is required.\n\nAvailable skills:\n${formatSkillNames(
      availableSkills.map((skill) => skill.name)
    )}`
  }

  const skill = availableSkills.find((item) => item.name.toLowerCase() === requested)
  if (!skill) {
    return `Skill "${name}" not found.\n\nAvailable skills:\n${formatSkillNames(
      availableSkills.map((item) => item.name)
    )}`
  }

  const sections = [`## Skill: ${skill.name}`]
  if (skill.description.length > 0) {
    sections.push("", `**Description**: ${skill.description}`)
  }
  if (skill.allowedTools && skill.allowedTools.length > 0) {
    sections.push("", `**Allowed tools**: ${skill.allowedTools.join(", ")}`)
  }
  sections.push("", skill.content)

  return sections.join("\n")
}
