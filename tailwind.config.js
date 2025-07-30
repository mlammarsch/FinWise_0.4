// tailwind.config.js
import daisyui from "daisyui";

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
  plugins: [daisyui],
  daisyui: {
    themes: ["light", "dark"],
    darkTheme: "dark",
    base: true,
    styled: true,
    utils: true,
    prefix: "",
    logs: true,
    themeRoot: ":root",
  },
};
