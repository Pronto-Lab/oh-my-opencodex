export type McpToolContext = {
  workingDirectory: string
  config: unknown
}

export type McpToolResult = {
  content: Array<{ type: "text"; text: string }>
  isError?: boolean
}

export type RegisteredToolInfo = {
  name: string
  title: string
  description: string
}
