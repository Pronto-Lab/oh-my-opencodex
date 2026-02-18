import { z } from "zod"

export const HooksConfigSchema = z.array(z.string()).optional()

export type HooksConfig = z.infer<typeof HooksConfigSchema>
