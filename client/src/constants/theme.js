// Canonical "Corporate Navy & Teal" color reference for the app.
// Most components style via inline `style={{}}` objects gated by the `isDark`
// boolean from useTheme() rather than Tailwind classes, so this file documents
// the palette rather than being consumed directly everywhere — use it as the
// source of truth when adding new UI so colors stay consistent.

export const THEME = {
  light: {
    bg: '#F8FAFC',
    surface: '#FFFFFF',
    border: '#E2E8F0',
    textPrimary: '#0F172A',
    textMuted: '#64748B',
    primary: '#0D9488',   // teal — main accent (buttons, active states, highlights)
    secondary: '#4F46E5', // indigo — secondary accent
    success: '#16A34A',
    danger: '#DC2626',
    warning: '#D97706',
  },
  dark: {
    bg: '#0B1120',
    surface: 'rgba(19,28,46,0.75)',
    border: 'rgba(255,255,255,0.08)',
    textPrimary: '#F1F5F9',
    textMuted: '#94A3B8',
    primary: '#2DD4BF',   // teal — brighter for contrast on dark backgrounds
    secondary: '#6366F1',
    success: '#4ADE80',
    danger: '#F87171',
    warning: '#FBBF24',
  },
};

export const getTheme = (isDark) => (isDark ? THEME.dark : THEME.light);
