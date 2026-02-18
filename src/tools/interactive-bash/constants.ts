export const BLOCKED_TMUX_SUBCOMMANDS = [
  "capture-pane",
  "capturep",
  "save-buffer",
  "saveb",
  "show-buffer",
  "showb",
  "pipe-pane",
  "pipep",
] as const

export const BLOCKED_COMMAND_MESSAGE = (subcommand: string, sessionName: string): string =>
  `Error: '${subcommand}' is blocked in interactive_bash.

Use Bash tool instead:

tmux capture-pane -p -t ${sessionName}
tmux capture-pane -p -t ${sessionName} -S -1000`
