// Quotes one path for a shell command line: cmd.exe on Windows (paths cannot contain '"'), POSIX sh elsewhere.
export function shellQuote(value, platform = process.platform) {
  if (platform === 'win32') {
    if (value.includes('"') || value.includes('%')) throw new Error(`Unsupported character in path: ${value}`)
    return `"${value}"`
  }
  return `'${value.replaceAll("'", `'\\''`)}'`
}
