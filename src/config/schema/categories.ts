import { z } from "zod"

export const CategorySchema = z.object({
  model: z.string(),
  description: z.string().optional(),
  reasoning_effort: z.enum(["minimal", "low", "medium", "high", "xhigh"]).optional(),
})

export type Category = z.infer<typeof CategorySchema>
