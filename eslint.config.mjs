import importPlugin from "eslint-plugin-import";
import jsonc from "eslint-plugin-jsonc";
import noUnsanitized from "eslint-plugin-no-unsanitized";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import sortKeysFix from "eslint-plugin-sort-keys-fix";
import unicorn from "eslint-plugin-unicorn";
import prettier from "eslint-plugin-prettier";
import { fixupPluginRules } from "@eslint/compat";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import sonarjs from "eslint-plugin-sonarjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  sonarjs.configs.recommended,
  {
    plugins: {
      import: fixupPluginRules(importPlugin),
      jsonc,
      "no-unsanitized": noUnsanitized,
      "simple-import-sort": simpleImportSort,
      "sort-keys-fix": sortKeysFix,
      unicorn,
      prettier,
    },
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  ...compat
    .extends(
      "plugin:@typescript-eslint/recommended",
      "plugin:jsonc/recommended-with-jsonc",
      "plugin:unicorn/recommended",
      "plugin:prettier/recommended",
      "plugin:@cspell/recommended",
    )
    .map(config => ({ ...config, files: ["src/**/*.mts", "testing/**/*.mts"] })),

  // everything
  {
    files: ["src/**/*.mts", "testing/**/*.mts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 5,
      sourceType: "script",
      parserOptions: {
        project: ["tsconfig.json"],
      },
    },
    rules: {
      "prettier/prettier": "error",
      "unicorn/switch-case-braces": "off",
      "unicorn/prefer-module": "off",
      "sonarjs/no-unused-expressions": "off",
      "@typescript-eslint/no-magic-numbers": "warn",
      "sonarjs/no-empty-function": "off",
      "unicorn/no-process-exit": "off",
      "unicorn/no-object-as-default-parameter": "off",
      "@cspell/spellchecker": ["warn", { checkComments: false, autoFix: true }],
      "unicorn/no-null": "off",
      "unicorn/no-empty-file": "off",
      "sonarjs/sonar-no-fallthrough": "off",
      "sonarjs/prefer-single-boolean-return": "off",
      "unicorn/no-array-callback-reference": "off",
      "sonarjs/prefer-nullish-coalescing": "off",
      "unicorn/no-await-expression-member": "off",
      "sonarjs/no-invalid-await": "off",
      "sonarjs/no-nested-functions": "off",
      "unicorn/no-useless-undefined": "off",
      "@typescript-eslint/unbound-method": "error",
      "import/no-extraneous-dependencies": ["error", { packageDir: "./" }],
      "sonarjs/prefer-immediate-return": "off",
      "unicorn/prevent-abbreviations": "off",
      "no-case-declarations": "off",
      "no-async-promise-executor": "off",
      "unicorn/prefer-node-protocol": "off",
      "unicorn/no-array-for-each": "off",
      "unicorn/import-style": "off",
      "sort-keys-fix/sort-keys-fix": "warn",
      "unicorn/prefer-event-target": "off",
      "simple-import-sort/imports": "warn",
      "sonarjs/no-misused-promises": "off",
      "sonarjs/no-commented-code": "off",
      "sonarjs/todo-tag": "off",
      "simple-import-sort/exports": "warn",
      "no-console": ["error"],
      "@typescript-eslint/no-unnecessary-type-constraint": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { varsIgnorePattern: "_|logger" }],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  // tests
  {
    files: ["testing/**/*.mts"],
    languageOptions: {
      globals: { ...globals.vi },
      parser: tsParser,
      ecmaVersion: 5,
      sourceType: "script",
      parserOptions: {
        project: ["tsconfig.spec.json"],
      },
    },
    rules: {
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-magic-numbers": "off",
      "sonarjs/no-duplicate-string": "off",
      "sonarjs/no-commented-code": "off",
      "sonarjs/no-dead-store": "off",
      "sonarjs/no-unused-collection": "warn",
      "unicorn/consistent-function-scoping": "off",
    },
  },
  // module definitions
  {
    files: ["src/**/*.module.mts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 5,
      sourceType: "script",
      parserOptions: {
        project: ["tsconfig.json"],
      },
    },
    rules: {
      "@typescript-eslint/no-magic-numbers": "off",
    },
  },
];
