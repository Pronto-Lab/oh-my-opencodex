import type { HookRegistry } from "../hook-registry"
import type { OhMyOpenCodexConfig } from "../../config/schema/oh-my-opencodex-config"

interface SkillInfo {
  name: string
  location: "builtin" | "custom"
}

function formatSkillNames(skills: SkillInfo[], limit: number): string {
  if (skills.length === 0) return "(none)"
  const shown = skills.slice(0, limit).map((s) => s.name)
  const remaining = skills.length - shown.length
  const suffix = remaining > 0 ? ` (+${remaining} more)` : ""
  return shown.join(", ") + suffix
}

function buildReminderMessage(builtinSkills: SkillInfo[], customSkills: SkillInfo[]): string {
  const builtinText = formatSkillNames(builtinSkills, 8)
  const customText = formatSkillNames(customSkills, 8)

  const exampleSkillName = customSkills[0]?.name ?? builtinSkills[0]?.name
  const loadSkills = exampleSkillName ? `["${exampleSkillName}"]` : "[]"

  const lines = [
    "",
    "[Category+Skill Reminder]",
    "",
    `**Built-in**: ${builtinText}`,
    `**⚡ YOUR SKILLS (PRIORITY)**: ${customText}`,
    "",
    "> User-installed skills OVERRIDE built-in defaults. ALWAYS prefer YOUR SKILLS when domain matches.",
    "",
    "```typescript",
    `task(category="visual-engineering", load_skills=${loadSkills}, run_in_background=true)`,
    "```",
    "",
  ]

  return lines.join("\n")
}

export function createCategorySkillReminderHook(
  config: OhMyOpenCodexConfig,
  registry: HookRegistry,
): void {
  const builtinSkills: SkillInfo[] = [
    { name: "playwright", location: "builtin" },
    { name: "frontend-ui-ux", location: "builtin" },
    { name: "git-master", location: "builtin" },
    { name: "dev-browser", location: "builtin" },
  ]

  const customSkills: SkillInfo[] = [
    { name: "superpowers/using-git-worktrees", location: "custom" },
    { name: "superpowers/test-driven-development", location: "custom" },
    { name: "superpowers/systematic-debugging", location: "custom" },
  ]

  const reminderMessage = buildReminderMessage(builtinSkills, customSkills)
  let reminderShown = false

  registry.register(
    "category-skill-reminder",
    "turn:started",
    () => {
      if (!reminderShown) {
        console.log(reminderMessage)
        reminderShown = true
      }
    },
    100,
  )
}
