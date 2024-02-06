import dayjs, { Dayjs } from "dayjs";

import { NONE, START, ZCC } from "../../utilities";

export function refTimes(times: TimeString[]): Dayjs[] {
  const today = dayjs().format("YYYY-MM-DD");
  return times.map(i => dayjs(`${today} ${i}`).millisecond(NONE));
}

type Digit = `${number}`;

type TimeString = Digit | `${Digit}:${Digit}` | `${Digit}:${Digit}:${Digit}`;

declare module "../../utilities" {
  export interface ZCCDefinition {
    /**
     * Quickly calculate reference points in time.
     * Times are in reference to 12AM/midnight this morning, and input in 24 hour format.
     * Values are input from left to right
     *
     * > HH[:mm[:ss]]
     *
     *
     * ## Usage Example
     *
     * ```typescript
     * const [AM830, PM3, TOMORROW] = is.refTimes(["8:30", "15", "24"]);
     * const now = dayjs();
     * if (!now.isBetween(AM830, PM3)) {
     *   console.log(
     *     `${Math.abs(now.diff(TOMORROW, "minute"))} minutes until tomorrow`,
     *   );
     * }
     * ```
     */
    refTime(times: TimeString[]): Dayjs[];
    /**
     * Quickly calculate reference points in time.
     * Times are in reference to 12AM/midnight this morning.
     *
     * > (AM|PM)[H]H[:(00|15|30|45)]
     *
     * Intended for readability and covering 90% of use cases. Use `refTime` for more configurable interface
     *
     * ## Usage Example
     *
     * ```typescript
     * const [NOW, AM830, PM3] = is.shortTime(["NOW", "AM8:30", "PM3", "24"]);
     * if (!NOW.isBetween(AM830, PM3)) {
     *   console.log(
     *     `Not in range`,
     *   );
     * }
     * ```
     */
    shortTime(times: ShortTime[]): Dayjs[];
  }
}

type ShortTime = `${AmPm}${ShortDigits}${ShortSuffix}` | "NOW" | "TOMORROW";
type ShortDigits =
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "01"
  | "02"
  | "03"
  | "04"
  | "05"
  | "06"
  | "07"
  | "08"
  | "09"
  | "10"
  | "11"
  | "12";
type AmPm = "AM" | "PM";
type ShortSuffix = "" | ":00" | ":15" | ":30" | ":45";

const SLICE_LENGTH = "AM".length;
const ROLLOVER = 12;
ZCC.refTime = refTimes;

ZCC.shortTime = function (times: ShortTime[]): Dayjs[] {
  const now = dayjs();
  const today = now.format("YYYY-MM-DD");
  return times.map(i => {
    if (i === "NOW") {
      return now;
    }
    if (i === "TOMORROW") {
      return dayjs(`${today} 24`);
    }
    let [hour, minute] = i.slice(SLICE_LENGTH).split(":");
    minute ??= "00";
    if (i.charAt(START).toLowerCase() === "p") {
      hour = (Number(hour) + ROLLOVER).toString();
    }
    return dayjs(`${today} ${hour}:${minute}`).millisecond(NONE);
  });
};
