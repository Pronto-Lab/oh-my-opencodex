const EXCLUDED_ENV_PATTERNS: RegExp[] = [
  /^NPM_CONFIG_/i,
  /^npm_config_/,
  /^YARN_/,
  /^PNPM_/,
  /^NO_UPDATE_NOTIFIER$/,
]

export function filterSensitiveEnvVars(customEnv: Record<string, string> = {}): Record<string, string> {
  const sanitized: Record<string, string> = {}

  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) {
      continue
    }

    const excluded = EXCLUDED_ENV_PATTERNS.some((pattern) => pattern.test(key))
    if (!excluded) {
      sanitized[key] = value
    }
  }

  Object.assign(sanitized, customEnv)
  return sanitized
}
