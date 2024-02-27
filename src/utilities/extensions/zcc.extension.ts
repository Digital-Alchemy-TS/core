import dayjs, { Dayjs } from "dayjs";
import { EventEmitter } from "events";
import { Get } from "type-fest";

import { ARRAY_OFFSET, DAY, HOUR, is, MINUTE, SECOND, START } from "..";

const FIRST = 0;
const EVERYTHING_ELSE = 1;
type inputFormats = Date | string | number | Dayjs;
const formatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
  style: "short",
});

const DAYS = 365;
const MONTHS = 12;
const YEAR = DAY * DAYS;
export class ZCCDefinition_Utils {
  public TitleCase(input: string): string {
    const matches = input.match(new RegExp("[a-z][A-Z]", "g"));
    if (matches) {
      matches.forEach((i) => (input = input.replace(i, [...i].join(" "))));
    }
    return input
      .split(new RegExp("[ _-]"))
      .map(
        (word = "") =>
          `${word.charAt(FIRST).toUpperCase()}${word.slice(EVERYTHING_ELSE)}`,
      )
      .join(" ");
  }

  public relativeDate(
    pastDate: inputFormats,
    futureDate: inputFormats = new Date().toISOString(),
  ) {
    const UNITS = new Map<Intl.RelativeTimeFormatUnit, number>([
      ["year", YEAR],
      ["month", YEAR / MONTHS],
      ["day", DAY],
      ["hour", HOUR],
      ["minute", MINUTE],
      ["second", SECOND],
    ]);

    if (!pastDate) {
      return `NOT A DATE ${pastDate} ${JSON.stringify(pastDate)}`;
    }
    const elapsed = dayjs(pastDate).diff(futureDate, "ms");
    let out = "";

    [...UNITS.keys()].some((unit) => {
      const cutoff = UNITS.get(unit);
      if (Math.abs(elapsed) > cutoff || unit == "second") {
        out = formatter.format(Math.round(elapsed / cutoff), unit);
        return true;
      }
      return false;
    });

    return out;
  }

  public object = {
    del<T>(object: T, path: string): void {
      const keys = path.split(".");
      let current = object as unknown; // Starting with the object as an unknown type

      for (let i = START; i < keys.length; i++) {
        const key = keys[i];

        // Check if current is an object and not null
        if (typeof current !== "object" || current === null) {
          // Path does not exist; exit function silently
          return;
        }

        const safeCurrent = current as Record<string, unknown>;

        // If we're at the last key, attempt to delete the property
        if (i === keys.length - ARRAY_OFFSET) {
          delete safeCurrent[key]; // Delete without checking; non-existent keys are a no-op
        } else {
          // For non-last keys, if the next level doesn't exist or isn't an object, stop processing
          if (
            typeof safeCurrent[key] !== "object" ||
            safeCurrent[key] === null
          ) {
            return;
          }
          // Move to the next level in the path
          current = safeCurrent[key];
        }
      }
    },
    get<T, P extends string>(object: T, path: P): Get<T, P> {
      const keys = path.split(".");
      let current: unknown = object;

      for (const key of keys) {
        if (!is.object(current) || current === null || !(key in current)) {
          return undefined;
        }
        current = (current as Record<string, unknown>)[key];
      }

      return current as Get<T, P>;
    },
    set<T>(
      object: T,
      path: string,
      value: unknown,
      doNotReplace: boolean = false,
    ): void {
      const keys = path.split(".");
      let current = object as unknown; // Starting with the object as an unknown type

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        // Ensure current can be used as a record in the following operations
        if (typeof current !== "object" || current === null) {
          throw new Error("Attempting to set a value on a non-object.");
        }

        // Safely cast current to Record<string, unknown> after the type guard
        const safeCurrent = current as Record<string, unknown>;

        // For the last key, attempt to set the value
        if (i === keys.length - ARRAY_OFFSET) {
          if (!doNotReplace || !(key in safeCurrent)) {
            safeCurrent[key] = value;
          }
        } else {
          // If the current key does not exist or is not an object, create an object for it
          if (
            safeCurrent[key] === undefined ||
            typeof safeCurrent[key] !== "object" ||
            safeCurrent[key] === null
          ) {
            safeCurrent[key] = {};
          }
          // Move to the next level in the path
          current = safeCurrent[key];
        }
      }
    },
  };
}

export class ZCCDefinition {
  /**
   * The global eventemitter. All of `@digital-alchemy` will be wired through this
   *
   * **NOTE:** bootstrapping process will initialize this at boot, and cleanup at teardown.
   * Making listener changes should only be done from within the context of service functions
   */
  public event = new EventEmitter();

  public utils = new ZCCDefinition_Utils();
}

export const ZCC = new ZCCDefinition();
