import { basename, resolve } from "node:path"
import { readFile, stat } from "node:fs/promises"
import type { LookAtArgs, LookAtArgsWithAliases } from "./types"
import { MAX_TEXT_OUTPUT_CHARS } from "./constants"
import { normalizeLookAtArgs, validateLookAtArgs } from "./look-at-arguments"
import {
  classifyFileKind,
  extractBase64Payload,
  inferMimeTypeFromBase64,
  inferMimeTypeFromFilePath,
} from "./mime-type-inference"

function formatInlineMetadata(goal: string, mimeType: string, sizeBytes: number): string {
  return [
    "Source: imageData",
    `Goal: ${goal}`,
    `MIME Type: ${mimeType}`,
    `Decoded Size: ${sizeBytes} bytes`,
    "Description: Placeholder analysis for image/PDF input. Multimodal analysis will be wired later.",
  ].join("\n")
}

function formatFileMetadata(goal: string, path: string, mimeType: string, sizeBytes: number): string {
  return [
    `Source: ${path}`,
    `File Name: ${basename(path)}`,
    `Goal: ${goal}`,
    `MIME Type: ${mimeType}`,
    `Size: ${sizeBytes} bytes`,
  ].join("\n")
}

function truncateText(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_TEXT_OUTPUT_CHARS) {
    return { text, truncated: false }
  }
  return {
    text: text.slice(0, MAX_TEXT_OUTPUT_CHARS),
    truncated: true,
  }
}

async function describeFile(args: LookAtArgs): Promise<string> {
  const absolutePath = resolve(args.filePath ?? "")
  const fileStat = await stat(absolutePath)

  if (!fileStat.isFile()) {
    return `Error: Path is not a file: ${absolutePath}`
  }

  const mimeType = inferMimeTypeFromFilePath(absolutePath)
  const fileKind = classifyFileKind(absolutePath, mimeType)
  const metadata = formatFileMetadata(args.goal, absolutePath, mimeType, fileStat.size)

  if (fileKind === "image" || fileKind === "pdf" || fileKind === "binary") {
    return `${metadata}\nDescription: Placeholder analysis for non-text media. Multimodal analysis will be wired later.`
  }

  const content = await readFile(absolutePath, "utf8")
  const { text, truncated } = truncateText(content)
  const note = truncated ? "\n[Truncated to first 12000 characters]" : ""

  return `${metadata}\n\nGoal Context: ${args.goal}\n\nFile Content:\n${text}${note}`
}

export async function lookAt(rawArgs: { filePath?: string; goal: string; imageData?: string }): Promise<string> {
  const args = normalizeLookAtArgs(rawArgs as LookAtArgsWithAliases)
  const validationError = validateLookAtArgs(args)
  if (validationError) {
    return validationError
  }

  if (args.imageData) {
    const mimeType = inferMimeTypeFromBase64(args.imageData)
    const payload = extractBase64Payload(args.imageData)
    const sizeBytes = Buffer.from(payload, "base64").byteLength
    return formatInlineMetadata(args.goal, mimeType, sizeBytes)
  }

  try {
    return await describeFile(args)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return `Error: Failed to analyze file. ${message}`
  }
}
