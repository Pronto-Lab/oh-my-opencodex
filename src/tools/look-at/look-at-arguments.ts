import type { LookAtArgs, LookAtArgsWithAliases } from "./types"

export function normalizeLookAtArgs(args: LookAtArgsWithAliases): LookAtArgs {
  return {
    filePath: args.filePath ?? args.file_path ?? args.path,
    imageData: args.imageData ?? args.image_data,
    goal: (args.goal ?? "").trim(),
  }
}

export function validateLookAtArgs(args: LookAtArgs): string | null {
  const hasFilePath = Boolean(args.filePath)
  const hasImageData = Boolean(args.imageData)

  if (!args.goal) {
    return "Error: Missing required parameter 'goal'."
  }
  if (hasFilePath && /^https?:\/\//i.test(args.filePath ?? "")) {
    return "Error: Remote URLs are not supported for filePath."
  }
  if (!hasFilePath && !hasImageData) {
    return "Error: Must provide either 'filePath' or 'imageData'."
  }
  if (hasFilePath && hasImageData) {
    return "Error: Provide only one of 'filePath' or 'imageData', not both."
  }
  return null
}
