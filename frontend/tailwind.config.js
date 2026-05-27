/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // All driven by CSS variables in tokens.css
        bg: "var(--bg)",
        "bg-elev": "var(--bg-elev)",
        "bg-hover": "var(--bg-hover)",
        fg: "var(--fg)",
        "fg-dim": "var(--fg-dim)",
        "fg-mute": "var(--fg-mute)",
        accent: "var(--accent)",
        "accent-dim": "var(--accent-dim)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        ok: "var(--ok)",
        warn: "var(--warn)",
        bad: "var(--bad)",
        crit: "var(--crit)",
      },
      borderRadius: {
        none: "0",
        sm: "0",
        md: "0",
        lg: "0",
        xl: "0",
      },
    },
  },
  plugins: [],
};
