import type { Config } from 'tailwindcss';

/**
 * Palette pulled from the materials of a Navratri night rather than a screen:
 * soot-black wood, khadi cotton, kumkum powder, turmeric, indigo dye,
 * henna leaf and a dusty gulal pink. Flat, slightly desaturated, no neon.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1A1410',
          2: '#231B15',
          3: '#2E241C',
        },
        paper: {
          DEFAULT: '#F3EADB',
          2: '#E7D9C1',
          3: '#D6C3A3',
        },
        kumkum: {
          DEFAULT: '#B23A2E',
          dark: '#8A2A21',
        },
        haldi: {
          DEFAULT: '#D8A23A',
          dark: '#A87B22',
        },
        neel: {
          DEFAULT: '#2F4B6E',
          light: '#5C7BA0',
        },
        mehndi: '#6B7A3A',
        gulal: '#C2566B',
      },
      fontFamily: {
        display: ['var(--font-cinzel)', 'serif'],
        sans: ['var(--font-nunito)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        flip: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '45%, 55%': { transform: 'rotate(180deg)' },
        },
      },
      animation: {
        marquee: 'marquee 40s linear infinite',
        hourglass: 'flip 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
