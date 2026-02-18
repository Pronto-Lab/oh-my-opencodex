import { z } from "zod"

export const BackgroundTaskSchema = z.object({
  max_concurrent: z.number().min(1).max(10).optional(),
})

export type BackgroundTask = z.infer<typeof BackgroundTaskSchema>
