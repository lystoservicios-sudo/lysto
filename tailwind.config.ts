import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './features/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        lysto: {
          blue: '#007BFF',
          blueDark: '#0057D9',
          blueSoft: '#EAF4FF',
          green: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          ink: '#07132F',
          muted: '#667085',
          border: '#E5EAF2',
          bg: '#F8FAFC'
        }
      },
      boxShadow: { soft: '0 18px 50px rgba(7, 19, 47, 0.08)', card: '0 12px 34px rgba(7, 19, 47, 0.06)' },
      borderRadius: { '3xl': '1.5rem' }
    }
  },
  plugins: []
}
export default config
