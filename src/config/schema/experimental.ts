import { z } from "zod"

export const ExperimentalSchema = z.record(z.string(), z.unknown()).optional()

export type Experimental = z.infer<typeof ExperimentalSchema>
