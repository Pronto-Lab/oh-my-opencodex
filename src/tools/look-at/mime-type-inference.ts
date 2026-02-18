import { extname } from "node:path"
import type { LookAtFileKind } from "./types"
import { CODE_EXTENSIONS } from "./constants"

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".html": "text/html",
  ".xml": "application/xml",
  ".json": "application/json",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
}

export function inferMimeTypeFromFilePath(filePath: string): string {
  const extension = extname(filePath).toLowerCase()
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream"
}

export function inferMimeTypeFromBase64(base64Data: string): string {
  const dataUriMatch = /^data:([^;]+);base64,/i.exec(base64Data)
  if (dataUriMatch?.[1]) {
    return dataUriMatch[1]
  }

  try {
    const stripped = base64Data.replace(/^data:[^;]+;base64,/i, "")
    const header = Buffer.from(stripped.slice(0, 64), "base64")

    if (header.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return "image/png"
    if (header.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg"
    if (header.subarray(0, 4).toString() === "GIF8") return "image/gif"
    if (header.subarray(0, 4).toString() === "%PDF") return "application/pdf"
  } catch {
    return "image/png"
  }

  return "image/png"
}

export function classifyFileKind(filePath: string, mimeType: string): LookAtFileKind {
  const extension = extname(filePath).toLowerCase()

  if (mimeType.startsWith("image/")) return "image"
  if (mimeType === "application/pdf") return "pdf"
  if (CODE_EXTENSIONS.has(extension)) return "code"
  if (mimeType.startsWith("text/") || mimeType.includes("json") || mimeType.includes("xml")) return "text"
  return "binary"
}

export function extractBase64Payload(imageData: string): string {
  const commaIndex = imageData.indexOf(",")
  if (imageData.startsWith("data:") && commaIndex >= 0) {
    return imageData.slice(commaIndex + 1)
  }
  return imageData
}
