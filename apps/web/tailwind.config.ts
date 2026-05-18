import path from 'node:path'
import type { Config } from 'tailwindcss'
import { colors, radius } from '../../packages/design-tokens/src/index'

const config: Config = {
  content: [
    path.join(__dirname, './app/**/*.{ts,tsx}'),
    path.join(__dirname, './components/**/*.{ts,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        'primary-50': colors.primary50,
        'primary-100': colors.primary100,
        'primary-500': colors.primary500,
        'primary-700': colors.primary700,
        accent: colors.accent,
        'accent-50': colors.accent50,
        surface: colors.surface,
        'surface-alt': colors.surfaceAlt,
        raised: colors.raised,
        ink: colors.ink,
        'ink-soft': colors.inkSoft,
        'ink-muted': colors.inkMuted,
        'ink-disabled': colors.inkDisabled,
        success: colors.success,
        warning: colors.warning,
        error: colors.error,
        info: colors.info,
        border: colors.border,
        'border-strong': colors.borderStrong,
      },
      borderRadius: {
        sm: radius.sm,
        md: radius.md,
        lg: radius.lg,
        xl: radius.xl,
        pill: radius.pill,
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
