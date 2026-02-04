/**
 * Design Tokens
 * Central design system for the Session Replay UI
 */

export const colors = {
  // Observation type colors (vibrant, meaningful)
  observation: {
    feature: {
      primary: '#8B5CF6', // Purple
      light: '#A78BFA',
      bg: '#F5F3FF',
      border: '#DDD6FE',
    },
    bugfix: {
      primary: '#EF4444', // Red
      light: '#F87171',
      bg: '#FEF2F2',
      border: '#FECACA',
    },
    decision: {
      primary: '#F59E0B', // Amber
      light: '#FBBf24',
      bg: '#FFFBEB',
      border: '#FDE68A',
    },
    discovery: {
      primary: '#3B82F6', // Blue
      light: '#60A5FA',
      bg: '#EFF6FF',
      border: '#BFDBFE',
    },
    refactor: {
      primary: '#10B981', // Green
      light: '#34D399',
      bg: '#ECFDF5',
      border: '#A7F3D0',
    },
    change: {
      primary: '#6B7280', // Gray
      light: '#9CA3AF',
      bg: '#F9FAFB',
      border: '#E5E7EB',
    },
  },

  // UI colors (modern, clean)
  ui: {
    background: {
      primary: '#FFFFFF',
      secondary: '#F9FAFB',
      tertiary: '#F3F4F6',
      dark: '#111827',
    },
    text: {
      primary: '#111827',
      secondary: '#6B7280',
      tertiary: '#9CA3AF',
      inverse: '#FFFFFF',
    },
    border: {
      light: '#E5E7EB',
      medium: '#D1D5DB',
      dark: '#9CA3AF',
    },
    accent: {
      primary: '#6366F1', // Indigo
      hover: '#4F46E5',
      light: '#E0E7FF',
    },
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },

  // Prompt color (distinct from observations)
  prompt: {
    primary: '#059669', // Emerald
    light: '#10B981',
    bg: '#D1FAE5',
    border: '#6EE7B7',
  },
};

export const spacing = {
  xs: '0.25rem', // 4px
  sm: '0.5rem', // 8px
  md: '1rem', // 16px
  lg: '1.5rem', // 24px
  xl: '2rem', // 32px
  '2xl': '3rem', // 48px
  '3xl': '4rem', // 64px
};

export const typography = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: '"SF Mono", "Monaco", "Inconsolata", "Fira Code", "Dank Mono", monospace',
  },
  fontSize: {
    xs: '0.75rem', // 12px
    sm: '0.875rem', // 14px
    base: '1rem', // 16px
    lg: '1.125rem', // 18px
    xl: '1.25rem', // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
};

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
};

export const borderRadius = {
  none: '0',
  sm: '0.25rem', // 4px
  md: '0.5rem', // 8px
  lg: '0.75rem', // 12px
  xl: '1rem', // 16px
  full: '9999px',
};

export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
};

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  modal: 1300,
  popover: 1400,
  tooltip: 1500,
};
