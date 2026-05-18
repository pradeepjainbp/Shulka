export const ease = {
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const

export const duration = {
  instant: '80ms',
  fast: '150ms',
  base: '200ms',
  slow: '320ms',
  longest: '480ms',
} as const
