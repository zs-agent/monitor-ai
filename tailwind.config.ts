import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'monitor': {
          bg: '#0a0a0f',
          'bg-card': '#12121a',
          'bg-sidebar': '#0c0c14',
          'bg-hover': '#16162a',
          border: '#1e1e2e',
          'text-primary': '#e5e5e5',
          'text-secondary': '#8b8ba0',
          'text-muted': '#5c5c72',
          accent: '#06b6d4',
          'accent-dim': '#0891b2',
        },
      },
      fontFamily: {
        mono: ["'SF Mono'", "'Fira Code'", "'Cascadia Code'", "'JetBrains Mono'", "monospace"],
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease-out both',
        'slide-in': 'slideIn 0.25s ease-out',
        'pulse-slow': 'pulse 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'radar-sweep': 'radarSweep 1.5s linear infinite',
        'radar-pulse': 'radarPulse 1.5s ease-in-out infinite',
        'severity-pulse': 'severityPulse 0.6s ease-in-out infinite',
        'new-badge-pulse': 'newBadgePulse 1s ease-in-out infinite',
        'bump': 'bump 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideIn: { '0%': { opacity: '0', transform: 'translateX(-4px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        pulse: { '0%, 100%': { opacity: '0.4' }, '50%': { opacity: '0.8' } },
        float: { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-3px)' } },
        radarSweep: { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
        radarPulse: { '0%, 100%': { transform: 'scale(1)', opacity: '0.6' }, '50%': { transform: 'scale(1.15)', opacity: '1' } },
        severityPulse: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.3' } },
        newBadgePulse: { '0%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.1)' }, '100%': { transform: 'scale(1)' } },
        bump: { '0%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.25)' }, '100%': { transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
}
export default config
