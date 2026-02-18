export interface BuiltinCommandArg {
  name: string
  description: string
  required?: boolean
}

export interface BuiltinCommand {
  name: string
  description: string
  template: string
  args?: BuiltinCommandArg[]
}
