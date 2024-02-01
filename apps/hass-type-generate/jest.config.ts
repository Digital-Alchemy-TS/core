/* eslint-disable */
export default {
  displayName: "hass-type-generate",
  preset: "../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }],
    "^.+\\.mts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }],
  },
  transformIgnorePatterns: [
    `node_modules/(?!chalk)`,
  ],
  moduleFileExtensions: ["mts", "ts", "js", "html"],
  coverageDirectory: "../../coverage/hass-type-generate",
};
