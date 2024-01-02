import { EventEmitter } from "eventemitter3";

export class ZCCDefinition {
  constructor() {
    this.event = new EventEmitter();
  }

  public readonly event: EventEmitter;
}

export const ZCC = new ZCCDefinition();
