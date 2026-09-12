import type { Config } from "tailwindcss";

/**
 * Sistema visual "Prisma competitivo" (`1.0.0` / MVP-3, ver
 * docs/DESIGN_SYSTEM.md). Los colores fisicos viven unicamente aqui, como
 * variables CSS semanticas (`src/app/globals.css`): los componentes usan
 * siempre estos nombres (`primary`, `game`, `info`, `reward`, `success`,
 * `danger`...), nunca un hexadecimal suelto. El patron `rgb(var(...) /
 * <alpha-value>)` permite usar opacidad Tailwind (`bg-primary/10`) sobre
 * variables CSS.
 */
function withOpacity(variableName: string) {
  return `rgb(var(${variableName}) / <alpha-value>)`;
}

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: withOpacity("--color-canvas"),
        surface: withOpacity("--color-surface"),
        "surface-muted": withOpacity("--color-surface-muted"),
        ink: withOpacity("--color-ink"),
        "text-muted": withOpacity("--color-text-muted"),
        border: {
          DEFAULT: withOpacity("--color-border"),
          strong: withOpacity("--color-border-strong"),
        },
        primary: {
          DEFAULT: withOpacity("--color-primary"),
          hover: withOpacity("--color-primary-hover"),
          soft: withOpacity("--color-primary-soft"),
        },
        game: {
          DEFAULT: withOpacity("--color-game"),
          ink: withOpacity("--color-game-ink"),
          soft: withOpacity("--color-game-soft"),
        },
        info: {
          DEFAULT: withOpacity("--color-info"),
          ink: withOpacity("--color-info-ink"),
          soft: withOpacity("--color-info-soft"),
        },
        reward: {
          DEFAULT: withOpacity("--color-reward"),
          ink: withOpacity("--color-reward-ink"),
          soft: withOpacity("--color-reward-soft"),
        },
        success: {
          DEFAULT: withOpacity("--color-success"),
          soft: withOpacity("--color-success-soft"),
        },
        danger: {
          DEFAULT: withOpacity("--color-danger"),
          ink: withOpacity("--color-danger-ink"),
          soft: withOpacity("--color-danger-soft"),
        },
      },
      fontFamily: {
        sans: ["var(--font-app)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
        control: "8px",
      },
      boxShadow: {
        floating: "0 8px 24px -8px rgb(23 32 51 / 0.18)",
        soft: "0 1px 2px rgb(23 32 51 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
