import { LIB_AUTOMATION_LOGIC } from "@zcc/automation-logic";
import { TServiceParams } from "@zcc/boilerplate";
import { TBlackHole, TContext, ZCC } from "@zcc/utilities";

type DeviceName = keyof typeof PicoIds;

export type PicoEvent<NAME extends DeviceName> = {
  action: "press" | "release";
  area_name: string;
  button_number: number;
  button_type: "off";
  device_id: (typeof PicoIds)[NAME];
  device_name: string;
  leap_button_number: number;
  serial: number;
  type: string;
};

const PicoIds = {
  bed: "f2aebfc943e4ed4f86936d0545cd0e60",
  bedroom: "b3d85455702ca9f8da158ad530e19aa7",
  desk: "732e1df4bcdcd6255be20d729c7c359f",
  games: "e5ba3501e60d5c74e76033bbfc297df1",
  living: "e9d176254b6d9b9e7d8aa06aa74c7d8f",
  loft: "68f4271ed5041a7072b839fe7726fd05",
  office: "ebdc303ec1cb7c44459441fc694e1d33",
  testing: "48be9ebd88bc0f50dfdb5ee8a70dfbfa",
} as const;

export enum Buttons {
  lower = "lower",
  stop = "stop",
  on = "on",
  off = "off",
  raise = "raise",
}

type PicoWatcher = {
  exec: () => TBlackHole;
  match: `${Buttons}`[];
  context: TContext;
};

type PicoBindings = Record<DeviceName, (options: PicoWatcher) => TBlackHole>;

export function LutronPicoBindings({ getApis }: TServiceParams): PicoBindings {
  const automation = getApis(LIB_AUTOMATION_LOGIC);

  function LutronPicoSequenceMatcher<NAME extends DeviceName>(
    target_device: NAME,
  ) {
    return function ({ match, exec, context }: PicoWatcher) {
      return automation.sequence({
        context,
        event_type: "lutron_caseta_button_event",
        exec: async () => ZCC.safeExec(async () => exec()),
        filter: ({ action, device_id }: PicoEvent<NAME>) =>
          action === "press" && device_id === PicoIds[target_device],
        label: target_device,
        match,
        path: "button_type",
      });
    };
  }
  const names = Object.keys(PicoIds) as DeviceName[];

  return Object.fromEntries(
    names.map(key => [key as DeviceName, LutronPicoSequenceMatcher(key)]),
  ) as PicoBindings;
}
