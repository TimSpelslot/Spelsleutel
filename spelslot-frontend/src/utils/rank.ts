export function rankColor(val: number): string {
  if (val <= 1) return 'var(--ss-rank-low)'
  if (val === 2) return 'var(--ss-rank-mid)'
  return 'var(--ss-rank-max)'
}

export function rankLabel(val: number): string {
  return ['', 'Low', 'Medium', 'High'][val] ?? `${val}`
}
