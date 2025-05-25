import daisyui from "daisyui";
import iconify from "@iconify/tailwind";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Segoe UI', 'Inter', 'Roboto', 'sans-serif', 'Lobster', 'Lobster Two'],
        'serif': ['Roboto Slab', 'serif'],
        'mono': ['Roboto Mono', 'monospace'],
        'lobster': ['Lobster', 'cursive'],
        'lobster-two': ['Lobster Two', 'cursive']
      }
    }
  },
  plugins: [
    iconify({
      iconSets: ['mdi', 'mdi-light']
    }),
    daisyui
  ],
  daisyui: {
    themes: [
      {
        dark: {
          "primary": "#856ac1",
          "primary-content": "#06040e",
          "secondary": "#a49db4",
          "secondary-content": "#140d0c",
          "accent": "#9d54bb",
          "accent-content": "#ecddf3",
          "neutral": "#a8a7a9",
          "neutral-content": "#0a090a",
          "base-100": "#1a161d",
          "base-200": "#302d34",
          "base-300": "#4f4c52",
          "base-content": "#bdbcbd",
          "info": "#1cadca",
          "info-content": "#000b0f",
          "success": "#76b279",
          "success-content": "#050c05",
          "warning": "#f1c40f",
          "warning-content": "#140e00",
          "error": "#cf5151",
          "error-content": "#100202",

          "--rounded-box": "8px",
          "--rounded-btn": "8px",
          "--rounded-tooltip": "1.9rem",
          "--animation-btn": "0.25s",
          "--animation-input": "0.2s",
          "--btn-focus-scale": "0.95",
          "--border-btn": "1px",
          "--tab-border": "1px",
          "--tab-radius": "8px",
          "--rounded-checkbox": "4px"
        }
      },
      {
        light: {
          "primary": "#856ac1",
          "primary-content": "#06040e",
          "secondary": "#a49db4",
          "secondary-content": "#140d0c",
          "accent": "#9d54bb",
          "accent-content": "#ecddf3",
          "neutral": "#a39fa8",
          "neutral-content": "#0a090a",
          "base-100": "#f0edf2",
          "base-200": "#d1ced2",
          "base-300": "#b2b0b4",
          "base-content": "#141414",
          "info": "#1cadca",
          "info-content": "#000b0f",
          "success": "#529455",
          "success-content": "#050c05",
          "warning": "#f1c40f",
          "warning-content": "#140e00",
          "error": "#cf5151",
          "error-content": "#100202",

          "--rounded-box": "8px",
          "--rounded-btn": "8px",
          "--rounded-tooltip": "1.9rem",
          "--animation-btn": "0.25s",
          "--animation-input": "0.2s",
          "--btn-focus-scale": "0.95",
          "--border-btn": "1px",
          "--tab-border": "1px",
          "--tab-radius": "0.5rem",
          "--rounded-checkbox": "4px"
        }
      }
    ]
  }
};
