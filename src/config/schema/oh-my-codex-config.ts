import { z } from "zod"
import { AgentOverrideSchema } from "./agent-overrides"
import { CategorySchema } from "./categories"
import { HooksConfigSchema } from "./hooks"
import { BackgroundTaskSchema } from "./background-task"
import { CommentCheckerSchema } from "./comment-checker"
import { RalphLoopSchema } from "./ralph-loop"
import { ExperimentalSchema } from "./experimental"

export const OhMyCodexConfigSchema = z.object({
  $schema: z.string().optional(),

  default_agent: z.enum(["sisyphus", "hephaestus", "atlas"]).optional(),
  agents: z.record(z.string(), AgentOverrideSchema).optional(),

  approval_policy: z.enum(["never", "on-request", "on-failure", "untrusted"]).optional(),
  sandbox_mode: z.enum(["read-only", "workspace-write", "danger-full-access"]).optional(),
  web_search_mode: z.enum(["disabled", "cached", "live"]).optional(),

  disabled_hooks: HooksConfigSchema,
  disabled_tools: z.array(z.string()).optional(),
  disabled_mcps: z.array(z.string()).optional(),
  disabled_skills: z.array(z.string()).optional(),

  background_task: BackgroundTaskSchema.optional(),
  comment_checker: CommentCheckerSchema.optional(),
  ralph_loop: RalphLoopSchema.optional(),
  boulder: z.object({
    enabled: z.boolean().optional(),
    max_retries: z.number().optional(),
  }).optional(),

  categories: z.record(z.string(), CategorySchema).optional(),

  skills: z.object({
    paths: z.array(z.string()).optional(),
    recursive: z.boolean().optional(),
  }).optional(),

  notification: z.object({
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
  }).optional(),

  tmux: z.object({
    enabled: z.boolean().optional(),
    layout: z.string().optional(),
  }).optional(),

  env: z.record(z.string(), z.string()).optional(),

  _migrations: z.array(z.string()).optional(),
})

export type OhMyCodexConfig = z.infer<typeof OhMyCodexConfigSchema>
