import globals from "globals";

// public/src/ is native ES modules: imports are explicit, so `no-undef`
// needs no generated global list. The three CDN libraries are the only
// real globals (pinned UMD builds loaded from index.html).
export default [
  { ignores: ["node_modules/**", "tests/.shots/**"] },
  {
    files: ["public/src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, supabase: "readonly", Chart: "readonly", jspdf: "readonly" },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["error", { vars: "all", args: "none", caughtErrors: "none" }],
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-duplicate-case": "error",
      "no-unreachable": "error",
      "no-constant-condition": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "valid-typeof": "error",
      "no-redeclare": "error",
      "no-self-assign": "error",
      "no-unsafe-negation": "error",
      "use-isnan": "error",
    },
  },
  {
    // theme.js is the one classic script: it runs from <head> before first paint.
    files: ["public/theme.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: { ...globals.browser } },
    rules: { "no-undef": "error" },
  },
  {
    // Test files mix Node (the runner) with page.evaluate callbacks that run
    // in the browser against window.__arkives, so no-undef is not useful here.
    files: ["tests/**/*.mjs"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.node, ...globals.browser, __arkives: "readonly" } },
    rules: { "no-undef": "off", "no-unused-vars": "off" },
  },
];
