import { EventEmitter } from "eventemitter3";

const FIRST = 0;
const EVERYTHING_ELSE = 1;

export class ZCCDefinition {
  constructor() {
    this.event = new EventEmitter();
  }

  public readonly event: EventEmitter;

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
}

export const ZCC = new ZCCDefinition();
