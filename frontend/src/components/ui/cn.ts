// Minimal className joiner. No external dep (clsx/tailwind-merge not installed).
// Falsy values are dropped; truthy strings are space-joined.
export type ClassValue = string | number | false | null | undefined

export function cn(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(' ')
}

// Sign helper shared by data components: -1 / 0 / 1 from a numeric value.
export function signOf(v: number | null | undefined, epsilon = 0): -1 | 0 | 1 {
  if (v == null || Number.isNaN(v)) return 0
  if (v > epsilon) return 1
  if (v < -epsilon) return -1
  return 0
}

// Tone for up/down/neutral data coloring.
export type Tone = 'up' | 'down' | 'neutral' | 'accent' | 'cool'

export function toneFromSign(sign: -1 | 0 | 1): Tone {
  return sign > 0 ? 'up' : sign < 0 ? 'down' : 'neutral'
}

export const TONE_TEXT: Record<Tone, string> = {
  up: 'text-up',
  down: 'text-down',
  neutral: 'text-ink-dim',
  accent: 'text-accent',
  cool: 'text-cool',
}

export const TONE_COLOR_VAR: Record<Tone, string> = {
  up: 'var(--up)',
  down: 'var(--down)',
  neutral: 'var(--text-dim)',
  accent: 'var(--accent)',
  cool: 'var(--cool)',
}
