import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // 颜色 token：语义映射到 globals.css 的 CSS 自定义属性（单一事实来源）。
      // 组件不再写 `bg-[var(--bg-card)]` 任意值，而是 `bg-card` 等语义类；
      // 透明度用派生 token（`--edge-50` 等，见 globals.css），因为 Tailwind 无法对 hex 变量套 /N。
      colors: {
        base: 'var(--bg-primary)',
        card: 'var(--bg-card)',
        'card-2': 'var(--bg-card-2)',
        'card-3': 'var(--bg-card-3)',
        sidebar: 'var(--bg-sidebar)',
        hover: 'var(--bg-hover)',
        elevated: 'var(--bg-elevated)',
        edge: 'var(--border)',
        'edge-light': 'var(--border-light)',
        'edge-softer': 'var(--border-softer)',
        ink: 'var(--text-primary)',
        'ink-2': 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        dim: 'var(--text-dim)',
        accent: 'var(--accent)',
        'accent-dim': 'var(--accent-dim)',
        'accent-bg': 'var(--accent-bg)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--error)',
        'danger-bg': 'var(--error-bg)',
        overlay: 'var(--hover-overlay)',
        'kpi-bg': 'var(--kpi-bg)',
        // 透明度派生 token
        'edge-40': 'var(--edge-40)',
        'edge-50': 'var(--edge-50)',
        'edge-60': 'var(--edge-60)',
        'accent-30': 'var(--accent-30)',
        'accent-40': 'var(--accent-40)',
        'accent-50': 'var(--accent-50)',
        'accent-60': 'var(--accent-60)',
        'accent-80': 'var(--accent-80)',
        'base-50': 'var(--base-50)',
        'card-2-50': 'var(--card-2-50)',
        'elevated-95': 'var(--elevated-95)',
        'accent-bg-30': 'var(--accent-bg-30)',
        'accent-bg-40': 'var(--accent-bg-40)',
        'warning-10': 'var(--warning-10)',
        'success-10': 'var(--success-10)',
        'success-40': 'var(--success-40)',
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "'Segoe UI'", "Roboto", "'Noto Sans'", "sans-serif"],
        mono: ["'SF Mono'", "'Fira Code'", "'Cascadia Code'", "'JetBrains Mono'", "monospace"],
      },
      fontSize: {
        'micro': ['10px', { lineHeight: '1.4' }],
        'xs': ['11px', { lineHeight: '1.4' }],
        'sm': ['12px', { lineHeight: '1.5' }],
        'base': ['14px', { lineHeight: '1.5' }],
        'md': ['16px', { lineHeight: '1.5' }],
        'lg': ['20px', { lineHeight: '1.3' }],
        'xl': ['26px', { lineHeight: '1.2' }],
        '2xl': ['32px', { lineHeight: '1.1' }],
      },
    },
  },
  plugins: [],
}
export default config
