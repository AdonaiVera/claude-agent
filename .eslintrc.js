module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:react/jsx-runtime",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  globals: {
    Atomics: "readonly",
    SharedArrayBuffer: "readonly",
    JSX: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
  },
  plugins: [
    "react",
    "@typescript-eslint",
    "prettier",
    "react-hooks",
    "only-warn",
  ],
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_|React",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/no-namespace": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "react/display-name": "off",
    "react/prop-types": 0,
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
