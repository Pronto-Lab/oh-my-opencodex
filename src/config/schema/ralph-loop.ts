import { z } from "zod"

export const RalphLoopSchema = z.object({
  enabled: z.boolean().optional(),
  max_iterations: z.number().optional(),
})

export type RalphLoop = z.infer<typeof RalphLoopSchema>
