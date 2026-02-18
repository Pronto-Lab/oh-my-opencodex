import * as z from "zod"
import { OhMyOpenCodexConfigSchema } from "../src/config/schema"

export function createOhMyOpenCodexJsonSchema(): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(OhMyOpenCodexConfigSchema, {
    target: "draft-07",
    unrepresentable: "any",
  })

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "https://raw.githubusercontent.com/code-yeongyu/oh-my-opencodex/master/assets/oh-my-opencodex.schema.json",
    title: "Oh My OpenCodex Configuration",
    description: "Configuration schema for oh-my-opencodex plugin",
    ...jsonSchema,
  }
}
