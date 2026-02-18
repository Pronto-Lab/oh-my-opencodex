export interface SessionListToolArgs {
  limit?: number
  from_date?: string
  to_date?: string
}

export interface SessionReadToolArgs {
  include_todos?: boolean
  include_transcript?: boolean
  limit?: number
}

export interface SessionSearchToolArgs {
  session_id?: string
  case_sensitive?: boolean
  limit?: number
}
