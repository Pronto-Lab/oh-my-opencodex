export function toToml(obj: Record<string, unknown>): string {
  const lines: string[] = []

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      continue
    }

    if (typeof value === "string") {
      lines.push(`${key} = "${escapeString(value)}"`)
    } else if (typeof value === "number" || typeof value === "boolean") {
      lines.push(`${key} = ${value}`)
    } else if (Array.isArray(value)) {
      const items = value.map((item) => {
        if (typeof item === "string") {
          return `"${escapeString(item)}"`
        }
        return String(item)
      })
      lines.push(`${key} = [${items.join(", ")}]`)
    } else if (typeof value === "object" && value !== null) {
      lines.push(`[${key}]`)
      const nested = value as Record<string, unknown>
      for (const [nestedKey, nestedValue] of Object.entries(nested)) {
        if (nestedValue === null || nestedValue === undefined) {
          continue
        }
        if (typeof nestedValue === "string") {
          lines.push(`${nestedKey} = "${escapeString(nestedValue)}"`)
        } else if (typeof nestedValue === "number" || typeof nestedValue === "boolean") {
          lines.push(`${nestedKey} = ${nestedValue}`)
        } else if (Array.isArray(nestedValue)) {
          const items = nestedValue.map((item) => {
            if (typeof item === "string") {
              return `"${escapeString(item)}"`
            }
            return String(item)
          })
          lines.push(`${nestedKey} = [${items.join(", ")}]`)
        }
      }
    }
  }

  return lines.join("\n")
}

function escapeString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r")
}
