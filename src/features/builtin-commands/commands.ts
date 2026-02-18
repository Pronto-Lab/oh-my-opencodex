import type { BuiltinCommand } from "./types"

const RALPH_LOOP_TEMPLATE = `Start a Ralph loop and keep iterating until the task is fully complete.

Rules:
- Keep making concrete progress each iteration.
- Do not stop at partial completion.
- When complete, return the completion promise token.
- Use todo tracking to reflect real progress.

Arguments: {{args}}`

const STOP_CONTINUATION_TEMPLATE = `Stop all continuation mechanisms for the current session.

Actions:
1. Stop Ralph loop continuation
2. Stop todo auto-continuation
3. Clear continuation-related session/project state

Report what was stopped and what remains active.`

const INIT_DEEP_TEMPLATE = `Initialize hierarchical AGENTS.md knowledge for this repository.

Primary target paths:
- ./.codex/AGENTS.md or repository AGENTS.md hierarchy
- Subdirectory AGENTS.md files for high-complexity domains

Workflow:
1. Analyze project structure and conventions
2. Decide AGENTS.md coverage by complexity
3. Generate concise, non-generic guidance files
4. Validate for duplication and stale content

Arguments: {{args}}`

const HANDOFF_TEMPLATE = `Create a context handoff summary for continuing in a new session.

Include:
- Verbatim user requests
- Completed work and current state
- Pending tasks and blockers
- Key files and decisions
- Explicit constraints

Arguments: {{args}}`

const REFACTOR_TEMPLATE = `Perform intelligent refactoring with safety checks.

Process:
1. Identify target scope and references
2. Use language-aware tooling where available
3. Apply minimal safe edits preserving behavior
4. Validate diagnostics and typecheck/tests
5. Summarize changes and risks

Arguments: {{args}}`

const START_WORK_TEMPLATE = `Start execution from an existing plan.

Process:
1. Read plan goals, constraints, and checkpoints
2. Convert plan into actionable todos
3. Execute in dependency order
4. Verify outputs at each checkpoint
5. Report progress and remaining tasks

Arguments: {{args}}`

export function getBuiltinCommands(): BuiltinCommand[] {
  return [
    {
      name: "ralph-loop",
      description: "(builtin) Start self-referential development loop until completion",
      template: RALPH_LOOP_TEMPLATE,
      args: [{ name: "task", description: "Task description for the loop", required: true }],
    },
    {
      name: "stop-continuation",
      description: "(builtin) Stop all continuation mechanisms for this session",
      template: STOP_CONTINUATION_TEMPLATE,
    },
    {
      name: "init-deep",
      description: "(builtin) Initialize hierarchical AGENTS.md knowledge base",
      template: INIT_DEEP_TEMPLATE,
      args: [{ name: "options", description: "Optional flags such as --create-new or --max-depth" }],
    },
    {
      name: "handoff",
      description: "(builtin) Create a detailed context summary for a new session",
      template: HANDOFF_TEMPLATE,
      args: [{ name: "goal", description: "Optional continuation goal" }],
    },
    {
      name: "refactor",
      description: "(builtin) Intelligent refactoring command",
      template: REFACTOR_TEMPLATE,
      args: [{ name: "target", description: "Refactoring target and scope", required: true }],
    },
    {
      name: "start-work",
      description: "(builtin) Start work from a written plan",
      template: START_WORK_TEMPLATE,
      args: [{ name: "plan", description: "Plan name or objective", required: true }],
    },
  ]
}
