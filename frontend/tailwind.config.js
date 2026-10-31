/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef8ff",
          100: "#d8eeff",
          200: "#b9e0ff",
          300: "#89cdfe",
          400: "#52affb",
          500: "#2b8ef6",
          600: "#146ee9",
          700: "#0f58d7",
          800: "#1347ad",
          900: "#153e88",
        },
      },
    },
  },
  plugins: [],
};

