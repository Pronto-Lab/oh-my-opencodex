import type { OhMyOpenCodexConfig } from "../../config/schema/oh-my-opencodex-config"
import type { Category } from "../../config/schema/categories"
import type { CategoryResolution } from "./types"

const BUILTIN_CATEGORIES: Record<string, CategoryResolution> = {
  quick: {
    model: "gpt-5-nano",
    reasoningEffort: "low",
    description: "Fast, lightweight tasks with minimal depth.",
  },
  deep: {
    model: "gpt-5.1",
    reasoningEffort: "medium",
    description: "Balanced deep analysis for non-trivial implementation.",
  },
  ultrabrain: {
    model: "gpt-5.3-codex",
    reasoningEffort: "high",
    description: "Maximum depth for complex architecture and hard bugs.",
  },
  "visual-engineering": {
    model: "gpt-5.1",
    reasoningEffort: "medium",
    description: "UI work with pragmatic implementation detail.",
  },
  artistry: {
    model: "gpt-5.3-codex",
    reasoningEffort: "high",
    description: "High-fidelity creative output and polish.",
  },
  "unspecified-low": {
    model: "gpt-5-nano",
    reasoningEffort: "low",
    description: "Default low-cost category for unspecified tasks.",
  },
  "unspecified-high": {
    model: "gpt-5.1",
    reasoningEffort: "high",
    description: "Default high-depth category for unspecified tasks.",
  },
  writing: {
    model: "gpt-5.1",
    reasoningEffort: "medium",
    description: "Drafting and editing writing-heavy tasks.",
  },
}

function mapReasoningEffort(
  value: "minimal" | "low" | "medium" | "high" | "xhigh" | undefined,
): "minimal" | "low" | "medium" | "high" | "xhigh" {
  return value ?? "medium"
}

function normalizeCategory(
  category: Category,
  fallbackDescription: string,
): CategoryResolution {
  return {
    model: category.model,
    reasoningEffort: mapReasoningEffort(category.reasoning_effort),
    description: category.description ?? fallbackDescription,
  }
}

function buildCategoryMap(config: OhMyOpenCodexConfig): Record<string, CategoryResolution> {
  const mergedCategories: Record<string, CategoryResolution> = { ...BUILTIN_CATEGORIES }
  const userCategories = config.categories ?? {}

  for (const [name, category] of Object.entries(userCategories)) {
    const fallbackDescription = BUILTIN_CATEGORIES[name]?.description ?? `User-defined category: ${name}`
    mergedCategories[name] = normalizeCategory(category, fallbackDescription)
  }

  return mergedCategories
}

export function resolveCategory(name: string, config: OhMyOpenCodexConfig): CategoryResolution {
  const mergedCategories = buildCategoryMap(config)
  const resolution = mergedCategories[name]

  if (!resolution) {
    const availableCategories = Object.keys(mergedCategories).sort().join(", ")
    throw new Error(`Unknown category: ${name}. Available categories: ${availableCategories}`)
  }

  return resolution
}
