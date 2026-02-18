export interface BackgroundOutputArgs {
  taskId: string
  block?: boolean
  timeout?: number
  fullSession?: boolean
}

export interface BackgroundCancelArgs {
  taskId?: string
  all?: boolean
}
