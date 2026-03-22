import globals from "globals";

export default [{
  languageOptions: {
    ecmaVersion: 2021,
    sourceType: "script",
    globals: {
      ...globals.browser,
      // CDN libraries referenced in website-building skill files
      Chart: "readonly", d3: "readonly", gsap: "readonly", ScrollTrigger: "readonly",
      THREE: "readonly", Motion: "readonly", Lenis: "readonly",
      React: "readonly", ReactDOM: "readonly", Vue: "readonly",
      Phaser: "readonly", PIXI: "readonly", p5: "readonly", Kaboom: "readonly",
      L: "readonly", mapboxgl: "readonly",
      anime: "readonly", Tone: "readonly", lottie: "readonly",
      lucide: "readonly", SVG: "readonly", Snap: "readonly",
      CANNON: "readonly", RAPIER: "readonly",
      $: "readonly", jQuery: "readonly",
    }
  },
  rules: {
    "no-undef": "error",
    "no-dupe-keys": "error",
    "no-dupe-args": "error",
    "no-duplicate-case": "error",
    "no-unreachable": "error",
    "no-constant-condition": "error",
    "no-empty": "error",
    "valid-typeof": "error",
    "no-redeclare": "error",
  }
}];
