// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  safelist: [
    {
      pattern: /bg-(slate|gray|red|orange|yellow|green|blue|indigo|purple|pink)-(100|200|300|400|500|600|700|800|900)(\/[0-9]{2})?/,
    },
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
