import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import * as z from "zod/v4"
import type { McpToolContext } from "../types"

export function registerSessionTools(server: McpServer, context: McpToolContext): void {
  if (!context.disabledTools.has("session_list")) {
    server.registerTool(
      "session_list",
      {
        title: "Session List",
        description: "List historical sessions with metadata.",
        inputSchema: z.object({
          limit: z.number().int().min(1).optional(),
          from_date: z.string().optional(),
          to_date: z.string().optional(),
          project_path: z.string().optional(),
        }),
      },
      async ({ limit, from_date, to_date }) => {
        const { sessionList } = await import("../../tools/session-manager")
        const result = await sessionList(context.sessionStore, { limit, from_date, to_date })
        return { content: [{ type: "text", text: result }] }
      },
    )
  }

  if (!context.disabledTools.has("session_read")) {
    server.registerTool(
      "session_read",
      {
        title: "Session Read",
        description: "Read chat/message history for a session.",
        inputSchema: z.object({
          session_id: z.string(),
          include_todos: z.boolean().optional(),
          include_transcript: z.boolean().optional(),
          limit: z.number().int().min(1).optional(),
        }),
      },
      async ({ session_id, include_todos, include_transcript, limit }) => {
        const { sessionRead } = await import("../../tools/session-manager")
        const result = await sessionRead(context.sessionStore, session_id, { include_todos, include_transcript, limit })
        return { content: [{ type: "text", text: result }] }
      },
    )
  }

  if (!context.disabledTools.has("session_search")) {
    server.registerTool(
      "session_search",
      {
        title: "Session Search",
        description: "Search full-text across session messages.",
        inputSchema: z.object({
          query: z.string(),
          session_id: z.string().optional(),
          case_sensitive: z.boolean().optional(),
          limit: z.number().int().min(1).optional(),
        }),
      },
      async ({ query, session_id, case_sensitive, limit }) => {
        const { sessionSearch } = await import("../../tools/session-manager")
        const result = await sessionSearch(context.sessionStore, query, { session_id, case_sensitive, limit })
        return { content: [{ type: "text", text: result }] }
      },
    )
  }

  if (!context.disabledTools.has("session_info")) {
    server.registerTool(
      "session_info",
      {
        title: "Session Info",
        description: "Get metadata and statistics about a session.",
        inputSchema: z.object({ session_id: z.string() }),
      },
      async ({ session_id }) => {
        const { sessionInfo } = await import("../../tools/session-manager")
        const result = await sessionInfo(context.sessionStore, session_id)
        return { content: [{ type: "text", text: result }] }
      },
    )
  }

  if (!context.disabledTools.has("background_output")) {
    server.registerTool(
      "background_output",
      {
        title: "Background Output",
        description: "Get output from a background task.",
        inputSchema: z.object({
          task_id: z.string(),
          block: z.boolean().optional(),
          timeout: z.number().int().min(1).optional(),
          full_session: z.boolean().optional(),
          include_thinking: z.boolean().optional(),
          message_limit: z.number().int().min(1).optional(),
          since_message_id: z.string().optional(),
          include_tool_results: z.boolean().optional(),
          thinking_max_chars: z.number().int().min(1).optional(),
        }),
      },
      async ({ task_id, block, timeout, full_session }) => {
        const { backgroundOutput } = await import("../../tools/background-task")
        const result = await backgroundOutput(context.threadPool, { taskId: task_id, block, timeout, fullSession: full_session })
        return { content: [{ type: "text", text: result }] }
      },
    )
  }

  if (!context.disabledTools.has("background_cancel")) {
    server.registerTool(
      "background_cancel",
      {
        title: "Background Cancel",
        description: "Cancel one or more running background tasks.",
        inputSchema: z.object({ task_id: z.string().optional(), all: z.boolean().optional() }),
      },
      async ({ task_id, all }) => {
        const { backgroundCancel } = await import("../../tools/background-task")
        const result = await backgroundCancel(context.threadPool, { taskId: task_id, all })
        return { content: [{ type: "text", text: result }] }
      },
    )
  }

  if (!context.disabledTools.has("call_agent")) {
    server.registerTool(
      "call_agent",
      {
        title: "Call Agent",
        description: "Spawn explore/librarian/oracle subagent tasks.",
        inputSchema: z.object({
          description: z.string(),
          prompt: z.string(),
          subagent_type: z.string(),
          run_in_background: z.boolean(),
          session_id: z.string().optional(),
          load_skills: z.array(z.string()).optional(),
        }),
      },
      async ({ description, prompt, subagent_type, run_in_background, session_id, load_skills }) => {
        const { callAgent } = await import("../../tools/call-agent")
        const result = await callAgent(context.threadPool, {
          description,
          prompt,
          subagentType: subagent_type,
          runInBackground: run_in_background,
          sessionId: session_id,
          loadSkills: load_skills,
        })
        return { content: [{ type: "text", text: result }] }
      },
    )
  }

  if (!context.disabledTools.has("delegate_task")) {
    server.registerTool(
      "delegate_task",
      {
        title: "Delegate Task",
        description: "Delegate tasks by category routing or subagent selection.",
        inputSchema: z.object({
          description: z.string(),
          prompt: z.string(),
          category: z.string().optional(),
          subagent_type: z.string().optional(),
          skills: z.array(z.string()).optional(),
          load_skills: z.array(z.string()).optional(),
          run_in_background: z.boolean().optional(),
          session_id: z.string().optional(),
          command: z.string().optional(),
        }),
      },
      async ({ description, prompt, category, subagent_type, skills, load_skills, run_in_background, session_id, command }) => {
        const { delegateTask } = await import("../../tools/delegate-task")
        const result = await delegateTask(context.threadPool, context.config, context.workingDirectory, {
          description,
          prompt,
          category,
          subagentType: subagent_type,
          skills: load_skills ?? skills,
          runInBackground: run_in_background,
          sessionId: session_id,
          command,
        })
        return { content: [{ type: "text", text: result }] }
      },
    )
  }
}
