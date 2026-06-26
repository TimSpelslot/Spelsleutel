/**
 * Spelslot PrimeVue theme preset.
 *
 * This is the single source of truth for the app's palette. It extends PrimeVue's
 * Aura preset and overrides its design tokens with the Spelslot brand
 * (warm parchment / amber / dark-brown), for both light and dark colour schemes.
 *
 * How it connects to the rest of the app:
 *   - PrimeVue components read these tokens directly (they become `--p-*` CSS variables).
 *   - `src/assets/tokens.css` aliases the legacy `--ss-*` variables onto the `--p-*`
 *     variables generated here, so custom CSS and PrimeVue components share one palette
 *     and switch light/dark together automatically.
 *
 * To create a new theme: copy this file, edit `LIGHT` / `DARK` / `PRIMARY_RAMP`,
 * and swap the import in `main.ts`. Nothing else needs to change.
 */
import { definePreset } from '@primevue/themes'
import Aura from '@primevue/themes/aura'

/** Brand primary ramp — the Tailwind "amber" scale. `600` (#D97706) is the brand accent. */
export const PRIMARY_RAMP = {
  50: '#FFFBEB',
  100: '#FEF3C7',
  200: '#FDE68A',
  300: '#FCD34D',
  400: '#FBBF24',
  500: '#F59E0B',
  600: '#D97706',
  700: '#B45309',
  800: '#92400E',
  900: '#78350F',
  950: '#451A03',
} as const

/**
 * Light scheme — reproduces the original `tokens.css` values exactly, so the existing
 * custom UI looks identical in light mode. Only PrimeVue components change (to match).
 */
export const LIGHT = {
  /** Warm surface ramp: white → parchment → tan → brown → espresso. */
  surface: {
    0: '#FFFFFF',
    50: '#F5F0E8',
    100: '#EDE8DB',
    200: '#E0D9CC',
    300: '#D4C4B0',
    400: '#B8A48C',
    500: '#9C8475',
    600: '#6B5744',
    700: '#4A3B2E',
    800: '#2D1B0E',
    900: '#1C1410',
    950: '#0F0A06',
  },
  primary: { color: '#D97706', hover: '#B45309', active: '#92400E', contrast: '#FFFFFF' },
  text: { color: '#1C1410', muted: '#6B5744', subtle: '#9C8475', inverse: '#F5F0E8' },
  content: { background: '#FFFFFF', border: '#D4C4B0' },
  // NB: avoid the key name `dark` here — the theme engine treats it as a reserved
  // colour-scheme marker, so a `parchment.dark` token never emits. Use `shade`.
  parchment: { base: '#F5F0E8', shade: '#EDE8DB', deeper: '#E0D9CC' },
  shell: { base: '#2D1B0E', lighter: '#3D2B1A', fg: '#F5F0E8', fgMuted: '#C4A882' },
  appSurface: { raised: '#FAF7F2', overlay: 'rgba(28, 20, 16, 0.6)' },
  appBorder: { subtle: '#EAE0D4' },
  feedback: {
    success: '#16A34A',
    successBg: '#DCFCE7',
    warning: '#CA8A04',
    warningBg: '#FEF9C3',
    danger: '#DC2626',
    dangerBg: '#FEE2E2',
    info: '#2563EB',
    infoBg: '#DBEAFE',
  },
  rank: { low: 'hsl(220 10% 60%)', ok: '#84CC16', mid: '#F59E0B', high: '#F97316', max: '#EF4444' },
  elevation: {
    sm: '0 1px 3px rgba(28, 20, 16, 0.12)',
    base: '0 4px 12px rgba(28, 20, 16, 0.15)',
    lg: '0 8px 24px rgba(28, 20, 16, 0.20)',
  },
}

/**
 * Dark scheme — a warm espresso counterpart (not pure black), amber accent kept and
 * slightly brightened for contrast. Tune these values freely; nothing else depends on them.
 */
export const DARK = {
  surface: {
    0: '#FFFFFF',
    50: '#FAF7F2',
    100: '#EDE8DB',
    200: '#D4C4B0',
    300: '#B8A48C',
    400: '#9C8475',
    500: '#6B5744',
    600: '#4A3B2E',
    700: '#3D2B1A',
    800: '#2D1B0E',
    900: '#231A12',
    950: '#1A130C',
  },
  primary: { color: '#F59E0B', hover: '#FBBF24', active: '#FCD34D', contrast: '#1C1410' },
  text: { color: '#F5F0E8', muted: '#C4A882', subtle: '#9C8475', inverse: '#1C1410' },
  content: { background: '#231A12', border: '#3D2B1A' },
  parchment: { base: '#1C1410', shade: '#231A12', deeper: '#2D2419' },
  shell: { base: '#15100B', lighter: '#231A12', fg: '#F5F0E8', fgMuted: '#C4A882' },
  appSurface: { raised: '#2D2419', overlay: 'rgba(0, 0, 0, 0.7)' },
  appBorder: { subtle: '#3D2B1A' },
  feedback: {
    success: '#22C55E',
    successBg: '#0F2A18',
    warning: '#EAB308',
    warningBg: '#2A2408',
    danger: '#EF4444',
    dangerBg: '#2E1212',
    info: '#3B82F6',
    infoBg: '#10233F',
  },
  rank: { low: 'hsl(220 10% 55%)', ok: '#84CC16', mid: '#F59E0B', high: '#F97316', max: '#EF4444' },
  elevation: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.4)',
    base: '0 4px 12px rgba(0, 0, 0, 0.5)',
    lg: '0 8px 24px rgba(0, 0, 0, 0.6)',
  },
}

/** Build one colour scheme's token object from a palette definition. */
function scheme(p: typeof LIGHT) {
  return {
    surface: p.surface,
    primary: {
      color: p.primary.color,
      contrastColor: p.primary.contrast,
      hoverColor: p.primary.hover,
      activeColor: p.primary.active,
    },
    text: {
      color: p.text.color,
      hoverColor: p.text.color,
      mutedColor: p.text.muted,
      hoverMutedColor: p.text.muted,
    },
    content: {
      background: p.content.background,
      borderColor: p.content.border,
    },
    // ── Custom brand tokens — emitted as --p-* CSS variables, aliased in tokens.css ──
    parchment: p.parchment,
    shell: p.shell,
    appSurface: p.appSurface,
    appBorder: p.appBorder,
    appText: { subtle: p.text.subtle, inverse: p.text.inverse },
    feedback: p.feedback,
    rank: p.rank,
    elevation: p.elevation,
  }
}

export const spelslotPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: PRIMARY_RAMP[50],
      100: PRIMARY_RAMP[100],
      200: PRIMARY_RAMP[200],
      300: PRIMARY_RAMP[300],
      400: PRIMARY_RAMP[400],
      500: PRIMARY_RAMP[500],
      600: PRIMARY_RAMP[600],
      700: PRIMARY_RAMP[700],
      800: PRIMARY_RAMP[800],
      900: PRIMARY_RAMP[900],
      950: PRIMARY_RAMP[950],
    },
    colorScheme: {
      light: scheme(LIGHT),
      dark: scheme(DARK),
    },
  },
})

export default spelslotPreset
