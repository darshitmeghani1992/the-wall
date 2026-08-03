// Expo's recommended ESLint config (React Native + TypeScript aware).
module.exports = {
  root: true,
  extends: "expo",
  ignorePatterns: ["dist", "node_modules", ".expo", "docs"],
  rules: {
    // TypeScript (tsc) already validates module resolution, incl. the "@/" alias.
    "import/no-unresolved": "off",
    // Apostrophes/quotes in user-facing copy are intentional.
    "react/no-unescaped-entities": "off",
  },
};
