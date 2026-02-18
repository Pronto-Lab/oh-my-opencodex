#!/usr/bin/env bun
import { createOhMyOpenCodexJsonSchema } from "./build-schema-document"

const SCHEMA_OUTPUT_PATH = "assets/oh-my-opencodex.schema.json"

async function main() {
  console.log("Generating JSON Schema...")

  const finalSchema = createOhMyOpenCodexJsonSchema()

  await Bun.write(SCHEMA_OUTPUT_PATH, JSON.stringify(finalSchema, null, 2))

  console.log(`✓ JSON Schema generated: ${SCHEMA_OUTPUT_PATH}`)
}

main()
