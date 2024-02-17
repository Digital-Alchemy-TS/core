import dayjs, { Dayjs } from "dayjs";
import { EventEmitter } from "events";

import { DAY, HOUR, MINUTE, SECOND } from "..";

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
      matches.forEach(i => (input = input.replace(i, [...i].join(" "))));
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

    [...UNITS.keys()].some(unit => {
      const cutoff = UNITS.get(unit);
      if (Math.abs(elapsed) > cutoff || unit == "second") {
        out = formatter.format(Math.round(elapsed / cutoff), unit);
        return true;
      }
      return false;
    });

    return out;
  }
}

export class ZCCDefinition {
  /**
   * The global eventemitter. All of `@zcc` will be wired through this
   *
   * **NOTE:** bootstrapping process will initialize this at boot, and cleanup at teardown.
   * Making listener changes should only be done from within the context of service functions
   */
  public event = new EventEmitter();

  public utils = new ZCCDefinition_Utils();
}

export const ZCC = new ZCCDefinition();
