import type { ConfigInputTypes, ConfigTypes } from "@digital-alchemy/core";

const STRICT_SCHEMA = {
  "~standard": {
    vendor: "strict-consumer",
    version: 1 as const,
    types: {} as { readonly input: string; readonly output: number },
    validate(value: unknown) {
      return { value: Number(value) };
    },
  },
};

type StrictConfiguration = { VALUE: { schema: typeof STRICT_SCHEMA } };
type StrictInput = ConfigInputTypes<StrictConfiguration>;
type StrictOutput = ConfigTypes<StrictConfiguration>;

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type ExpectTrue<T extends true> = T;

export type _StrictSchemaInputIsString = ExpectTrue<Equal<StrictInput["VALUE"], string>>;
export type _StrictSchemaOutputIsNumber = ExpectTrue<Equal<StrictOutput["VALUE"], number>>;

const encoded: StrictInput["VALUE"] = "7";
const decoded: StrictOutput["VALUE"] = 7;
void encoded;
void decoded;
