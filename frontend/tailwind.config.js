/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Forensic theme palette
        forensic: {
          'bg-primary': '#0a0a0a',
          'bg-secondary': '#111111',
          'bg-tertiary': '#1a1a1a',
          border: '#262626',
          'text-primary': '#e5e5e5',
          'text-secondary': '#737373',
          'text-muted': '#525252',
        },
        // Accent colors
        accent: {
          green: '#22c55e',
          'green-dim': '#166534',
          amber: '#f59e0b',
          red: '#ef4444',
          cyan: '#06b6d4',
          purple: '#a855f7',
          orange: '#f97316',
        },
        // Agent colors
        agent: {
          claude: '#f97316',
          gemini: '#22c55e',
          codex: '#a855f7',
        },
        // Observation type colors
        'obs-feature': '#8B5CF6',
        'obs-bugfix': '#EF4444',
        'obs-decision': '#F59E0B',
        'obs-discovery': '#3B82F6',
        'obs-refactor': '#6B7280',
        'obs-change': '#10B981',
        // Legacy UI colors (for backwards compat during transition)
        prompt: '#22C55E',
        'bg-card': '#111111',
        'border-card': '#262626',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'SF Mono', 'Monaco', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.2s ease-out',
        blink: 'blink 1s infinite',
        scanline: 'scanline 8s linear infinite',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        blink: {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      borderRadius: {
        none: '0',
        sm: '2px',
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
