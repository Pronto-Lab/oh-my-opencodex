import { z } from "zod"

export const CommentCheckerSchema = z.object({
  enabled: z.boolean().optional(),
  auto_fix: z.boolean().optional(),
})

export type CommentChecker = z.infer<typeof CommentCheckerSchema>
