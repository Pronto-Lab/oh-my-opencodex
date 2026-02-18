import type { BuiltinSkill } from "./types"

const PLAYWRIGHT_SKILL: BuiltinSkill = {
  name: "playwright",
  description:
    "MUST USE for browser tasks. Browser automation via Playwright MCP for testing, screenshots, scraping, and interactions.",
  content: `Use Playwright MCP when a task needs browser navigation, clicking, form input, screenshots, or scraping.

Core flow:
1. Open page
2. Inspect snapshot/DOM
3. Interact (click/fill/select)
4. Verify result with screenshot or assertions

Default to deterministic selectors and short, repeatable interaction steps.`,
  mcpConfig: {
    playwright: {
      command: "npx",
      args: ["@playwright/mcp@latest"],
    },
  },
}

const GIT_MASTER_SKILL: BuiltinSkill = {
  name: "git-master",
  description:
    "MUST USE for git work: atomic commits, clean history, and safe operations for commit/rebase/search tasks.",
  content: `When doing git operations:
- Analyze status and diff before action.
- Prefer small atomic commits grouped by concern.
- Follow repository commit message style from recent history.
- Use safe history edits only when appropriate.
- Never force dangerous actions without explicit user request.

For history search, use focused git log/blame/pickaxe commands and report concrete evidence.`,
}

const FRONTEND_UI_UX_SKILL: BuiltinSkill = {
  name: "frontend-ui-ux",
  description: "Designer-turned-developer who crafts intentional, high-quality UI/UX.",
  content: `Design with a strong visual direction and implement production-quality frontend.

Rules:
- Match existing design system if one exists.
- Use purposeful typography, spacing, color, and motion.
- Avoid generic default-looking layouts.
- Ensure responsive behavior on desktop and mobile.
- Prioritize clarity, hierarchy, accessibility, and polish.`,
}

const DEV_BROWSER_SKILL: BuiltinSkill = {
  name: "dev-browser",
  description:
    "Browser automation with persistent page state for iterative scripts and real workflow testing.",
  content: `Use persistent browser sessions for workflows spanning multiple steps.

Recommended loop:
1. Connect to named page/session
2. Execute one focused interaction script
3. Read state (url/title/dom/screenshot)
4. Continue from current state

Use this for end-to-end user flows, authenticated scenarios, and repeated browser tasks.`,
}

export function getBuiltinSkills(): BuiltinSkill[] {
  return [PLAYWRIGHT_SKILL, GIT_MASTER_SKILL, FRONTEND_UI_UX_SKILL, DEV_BROWSER_SKILL]
}
