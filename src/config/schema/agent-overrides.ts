import { z } from "zod"

export const AgentOverrideSchema = z.object({
  model: z.string().optional(),
  reasoning_effort: z.enum(["minimal", "low", "medium", "high", "xhigh"]).optional(),
  temperature: z.number().min(0).max(2).optional(),
  prompt_append: z.string().optional(),
})

export type AgentOverride = z.infer<typeof AgentOverrideSchema>
