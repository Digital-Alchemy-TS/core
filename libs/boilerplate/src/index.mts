import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat.js";
import isBetween from "dayjs/plugin/isBetween.js";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import weekOfYear from "dayjs/plugin/weekOfYear.js";
// ? both required for `dayjs().format("ww")`
// prints week number as part of the format string
dayjs.extend(weekOfYear);
dayjs.extend(advancedFormat);
dayjs.extend(isBetween);
dayjs.extend(utc);
dayjs.extend(timezone);

export * from "./extensions/index.mjs";
export * from "./helpers/index.mjs";
