export interface LookAtArgs {
  filePath?: string
  goal: string
  imageData?: string
}

export interface LookAtArgsWithAliases extends LookAtArgs {
  file_path?: string
  image_data?: string
  path?: string
}

export type LookAtFileKind = "image" | "pdf" | "code" | "text" | "binary"
