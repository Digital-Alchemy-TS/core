import { Dayjs } from "dayjs";

import { PICK_ENTITY } from "..";

export type CalendarFetchOptions = {
  /**
   * Calendar(s) to load events for.
   */
  calendar: PICK_ENTITY<"calendar"> | PICK_ENTITY<"calendar">[];
  /**
   * The end (exclusive) of the event.
   */
  end: Date | Dayjs;
  /**
   * The start (inclusive) of the event.
   *
   * > Default: now
   */
  start?: Date | Dayjs;
};

export type RawCalendarEvent = {
  /**
   * A detailed description of the event.
   */
  description?: string;
  end: { dateTime: string };
  /**
   * A geographic location of the event.
   */
  location?: string;
  /**
   * An optional identifier for a specific instance of a recurring event (required for mutations of recurring events)
   */
  recurrence_id?: string;
  /**
   * A recurrence rule string e.g. `FREQ=DAILY`
   */
  rrule?: string;
  start: { dateTime: string };
  /**
   * A title or summary of the event.
   */
  summary: string;
  /**
   * A unique identifier for the event (required for mutations)
   */
  uid?: string;
};

export type CalendarEvent = Omit<RawCalendarEvent, "end" | "start"> & {
  end: Dayjs;
  start: Dayjs;
};
