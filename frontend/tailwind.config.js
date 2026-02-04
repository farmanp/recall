/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Observation type colors
        'obs-feature': '#8B5CF6', // Purple
        'obs-bugfix': '#EF4444', // Red
        'obs-decision': '#F59E0B', // Yellow
        'obs-discovery': '#3B82F6', // Blue
        'obs-refactor': '#6B7280', // Gray
        'obs-change': '#10B981', // Green

        // UI colors
        prompt: '#22C55E', // Green
        'bg-card': '#F9FAFB', // Light gray
        'border-card': '#E5E7EB', // Border gray
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.2s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
