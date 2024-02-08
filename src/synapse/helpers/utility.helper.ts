import { ICON_DATA } from "./icon.helper";

export type OnOff = "on" | "off" | "unavailable";

// Utility type to extract all unique tag values from ICON_DATA
type ExtractTags<T> = T[keyof T];
type UniqueTagsFromArray<Array_> = Array_ extends readonly string[]
  ? Array_[number]
  : never;

export type MaterialIconTags = UniqueTagsFromArray<
  ExtractTags<typeof ICON_DATA>
>;

export type MaterialIcon<
  Tag extends `${MaterialIconTags}` | undefined = undefined,
> = {
  [Key in keyof typeof ICON_DATA]: Tag extends undefined
    ? Key // Return all keys if no tag is provided
    : Tag extends (typeof ICON_DATA)[Key][number]
      ? Key
      : never;
}[keyof typeof ICON_DATA];
