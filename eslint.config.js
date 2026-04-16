import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "no-undef": "error"
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
      },
      globals: {
        Phaser: "readonly",
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        CanvasRenderingContext2D: "readonly",
        AudioContext: "readonly",
        GainNode: "readonly",
        OscillatorNode: "readonly",
        OscillatorType: "readonly",
        performance: "readonly",
        KeyboardEvent: "readonly",
        localStorage: "readonly",
        btoa: "readonly",
        atob: "readonly",
        HTMLElement: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
  },
];
