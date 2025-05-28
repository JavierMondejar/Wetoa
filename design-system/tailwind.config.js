/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./**/*.html"],
  theme: {
    extend: {
      colors: {
        primary: "#1C244B",
        secondary: "#F3F5F8",
        text: "#324A6D",
        accent: "#EFD048",
        error: "#D53A3A",
        cta: "#467FF7",
        lightBackground: "#DFF0FF",
        black: "#343434",
        white: "#FFFFFF"
      },
      fontFamily: {
        sans: ["Poppins", "sans-serif"]
      },
      fontSize: {
        heading: "35px",
        body: "30px"
      },
      borderRadius: {
        custom: "30px"
      },
      fontWeight: {
        heading: "600",
        body: "300"
      }
    }
  },
  plugins: []
}
