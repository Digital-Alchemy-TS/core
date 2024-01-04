/* eslint-disable */
export default {
  displayName: "utilities",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }],
    "^.+\\.mts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }]
  },
  moduleFileExtensions: ["ts", "js", "mts", "html"],
  coverageDirectory: "../../coverage/libs/utilities",
};
