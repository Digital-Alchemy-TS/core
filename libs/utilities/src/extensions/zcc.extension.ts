import { EventEmitter } from "eventemitter3";

const FIRST = 0;
const EVERYTHING_ELSE = 1;

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
