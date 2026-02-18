import { existsSync, statSync } from "node:fs"
import { dirname, extname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { findServerForExtension } from "./config"
import { LSPClient, lspManager } from "./client"
import type { ServerLookupResult } from "./types"

export function findWorkspaceRoot(filePath: string): string {
  let dir = resolve(filePath)
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    dir = dirname(dir)
  }

  const markers = [".git", "package.json", "pyproject.toml", "Cargo.toml", "go.mod", "pom.xml", "build.gradle"]

  let prevDir = ""
  while (dir !== prevDir) {
    for (const marker of markers) {
      if (existsSync(join(dir, marker))) {
        return dir
      }
    }
    prevDir = dir
    dir = dirname(dir)
  }

  return dirname(resolve(filePath))
}

export function uriToPath(uri: string): string {
  return fileURLToPath(uri)
}

export function formatServerLookupError(result: Exclude<ServerLookupResult, { status: "found" }>): string {
  if (result.status === "not_installed") {
    const { server, installHint } = result
    return [
      `LSP server '${server.id}' is configured but NOT INSTALLED.`,
      "",
      `Command not found: ${server.command[0]}`,
      "",
      "To install:",
      `  ${installHint}`,
      "",
      `Supported extensions: ${server.extensions.join(", ")}`,
    ].join("\n")
  }

  return [
    `No LSP server configured for extension: ${result.extension}`,
    "",
    `Available servers: ${result.availableServers.slice(0, 10).join(", ")}${result.availableServers.length > 10 ? "..." : ""}`,
    "",
    "To add a custom server, configure 'lsp' in oh-my-codex.jsonc:",
    "  {",
    "    \"lsp\": {",
    "      \"my-server\": {",
    "        \"command\": [\"my-lsp\", \"--stdio\"],",
    `        \"extensions\": [\"${result.extension}\"]`,
    "      }",
    "    }",
    "  }",
  ].join("\n")
}

export async function withLspClient<T>(filePath: string, fn: (client: LSPClient) => Promise<T>): Promise<T> {
  const absPath = resolve(filePath)
  const ext = extname(absPath)
  const serverLookup = findServerForExtension(ext)
  if (serverLookup.status !== "found") {
    throw new Error(formatServerLookupError(serverLookup))
  }

  const root = findWorkspaceRoot(absPath)
  const client = await lspManager.getClient(root, serverLookup.server)

  try {
    return await fn(client)
  } catch (error) {
    if (error instanceof Error && error.message.includes("timeout") && lspManager.isServerInitializing(root, serverLookup.server.id)) {
      throw new Error(`LSP server is still initializing. Please retry in a few seconds. Original error: ${error.message}`)
    }
    throw error
  } finally {
    lspManager.releaseClient(root, serverLookup.server.id)
  }
}
