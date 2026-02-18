export type ContextResource = {
  uri: string
  name: string
  description: string
  content: string
}

export type ThreadPoolLike = {
  listTasks: () => Array<{
    id: string
    title: string
    description: string
    status: string
  }>
}

export type TodoWatcherLike = {
  getIncompleteTodos: () => Array<{
    content: string
    status: string
  }>
}
