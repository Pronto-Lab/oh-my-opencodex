import { existsSync, statSync } from "node:fs"
import { spawn, type ChildProcess } from "node:child_process"

export interface StreamReader {
  read(): Promise<{ done: boolean; value: Uint8Array | undefined }>
}

export interface UnifiedProcess {
  stdin: { write(chunk: Uint8Array | string): void }
  stdout: { getReader(): StreamReader }
  stderr: { getReader(): StreamReader }
  exitCode: number | null
  exited: Promise<number>
  kill(signal?: string): void
}

export function validateCwd(cwd: string): { valid: boolean; error?: string } {
  try {
    if (!existsSync(cwd)) {
      return { valid: false, error: `Working directory does not exist: ${cwd}` }
    }

    if (!statSync(cwd).isDirectory()) {
      return { valid: false, error: `Path is not a directory: ${cwd}` }
    }

    return { valid: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { valid: false, error: `Cannot access working directory: ${cwd} (${message})` }
  }
}

function wrapNodeProcess(proc: ChildProcess): UnifiedProcess {
  let exitCode: number | null = null
  let resolveExited: (code: number) => void = () => {}
  const exited = new Promise<number>((resolve) => {
    resolveExited = resolve
  })

  proc.on("exit", (code) => {
    exitCode = code ?? 1
    resolveExited(exitCode)
  })
  proc.on("error", () => {
    if (exitCode === null) {
      exitCode = 1
      resolveExited(1)
    }
  })

  const createStreamReader = (stream: NodeJS.ReadableStream | null): StreamReader => {
    const chunks: Uint8Array[] = []
    let ended = stream === null
    let waiter: ((result: { done: boolean; value: Uint8Array | undefined }) => void) | null = null

    if (stream) {
      stream.on("data", (chunk: Buffer) => {
        const bytes = new Uint8Array(chunk)
        if (waiter) {
          const resolve = waiter
          waiter = null
          resolve({ done: false, value: bytes })
          return
        }
        chunks.push(bytes)
      })

      const onDone = () => {
        ended = true
        if (waiter) {
          const resolve = waiter
          waiter = null
          resolve({ done: true, value: undefined })
        }
      }
      stream.on("end", onDone)
      stream.on("error", onDone)
    }

    return {
      read: async () => {
        if (chunks.length > 0) {
          return { done: false, value: chunks.shift() }
        }
        if (ended) {
          return { done: true, value: undefined }
        }
        return new Promise((resolve) => {
          waiter = resolve
        })
      },
    }
  }

  return {
    stdin: {
      write: (chunk) => {
        proc.stdin?.write(chunk)
      },
    },
    stdout: { getReader: () => createStreamReader(proc.stdout) },
    stderr: { getReader: () => createStreamReader(proc.stderr) },
    get exitCode() {
      return exitCode
    },
    exited,
    kill: (signal) => {
      proc.kill(signal as NodeJS.Signals | undefined)
    },
  }
}

export function spawnProcess(
  command: string[],
  options: { cwd: string; env: Record<string, string | undefined> }
): UnifiedProcess {
  const cwdValidation = validateCwd(options.cwd)
  if (!cwdValidation.valid) {
    throw new Error(`[LSP] ${cwdValidation.error}`)
  }

  const [cmd, ...args] = command
  const proc = spawn(cmd, args, {
    cwd: options.cwd,
    env: options.env as NodeJS.ProcessEnv,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    shell: process.platform === "win32",
  })

  return wrapNodeProcess(proc)
}
