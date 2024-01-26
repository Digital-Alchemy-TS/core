/**
 * TODO: this tsdoc is helpful, can it be integration with the rest of the definitions?
 */
export enum DeviceClass {
  /**
   * Generic sensor. This is the default and doesn’t need to be set.
   */
  None = "None",
  /**
   * Apparent power in VA.
   */
  apparent_power = "apparent_power",
  /**
   * Air Quality Index
   */
  aqi = "aqi",
  /**
   * Atmospheric pressure in cbar, bar, hPa, inHg, kPa, mbar, Pa, psi
   */
  atmospheric_pressure = "atmospheric_pressure",
  /**
   * Percentage of battery that is left
   */
  battery = "battery",
  /**
   * Carbon Dioxide in CO2 (Smoke)
   */
  carbon_dioxide = "carbon_dioxide",
  /**
   * Carbon Monoxide in CO (Gas CNG/LPG)
   */
  carbon_monoxide = "carbon_monoxide",
  /**
   * Current in A
   */
  current = "current",
  /**
   * Data rate in bit/s, kbit/s, Mbit/s, Gbit/s, B/s, kB/s, MB/s, GB/s, KiB/s, MiB/s, or GiB/s
   */
  data_rate = "data_rate",
  /**
   * Data size in bit, kbit, Mbit, Gbit, B, kB, MB, GB, TB, PB, EB, ZB, YB, KiB, MiB, GiB, TiB, PiB, EiB, ZiB, or YiB
   */
  data_size = "data_size",
  /**
   * Date string (ISO 8601)
   */
  date = "date",
  /**
   * Generic distance in km, m, cm, mm, mi, yd, or in
   */
  distance = "distance",
  /**
   * Duration in days, hours, minutes or seconds
   */
  duration = "duration",
  /**
   * Energy in Wh, kWh or MWh
   */
  energy = "energy",
  /**
   * Has a limited set of (non-numeric) states
   */
  enum = "enum",
  /**
   * Frequency in Hz, kHz, MHz or GHz
   */
  frequency = "frequency",
  /**
   * Gas volume in m³ or ft³
   */
  gas = "gas",
  /**
   * Percentage of humidity in the air
   */
  humidity = "humidity",
  /**
   * The current light level in lx or lm
   */
  illuminance = "illuminance",
  /**
   * Percentage of water in a substance
   */
  moisture = "moisture",
  /**
   * The monetary value
   */
  monetary = "monetary",
  /**
   * Concentration of Nitrogen Dioxide in µg/m³
   */
  nitrogen_dioxide = "nitrogen_dioxide",
  /**
   * Concentration of Nitrogen Monoxide in µg/m³
   */
  nitrogen_monoxide = "nitrogen_monoxide",
  /**
   * Concentration of Nitrous Oxide in µg/m³
   */
  nitrous_oxide = "nitrous_oxide",
  /**
   * Concentration of Ozone in µg/m³
   */
  ozone = "ozone",
  /**
   * Concentration of particulate matter less than 1 micrometer in µg/m³
   */
  pm1 = "pm1",
  /**
   * Concentration of particulate matter less than 10 micrometers in µg/m³
   */
  pm10 = "pm10",
  /**
   * Concentration of particulate matter less than 2.5 micrometers in µg/m³
   */
  pm25 = "pm25",
  /**
   * Power factor in %
   */
  power_factor = "power_factor",
  /**
   * Power in W or kW
   */
  power = "power",
  /**
   * Precipitation intensity in in/d, in/h, mm/d, or mm/h
   */
  precipitation_intensity = "precipitation_intensity",
  /**
   * Pressure in Pa, kPa, hPa, bar, cbar, mbar, mmHg, inHg, or psi
   */
  pressure = "pressure",
  /**
   * Reactive power in var
   */
  reactive_power = "reactive_power",
  /**
   * Signal strength in dB or dBm
   */
  signal_strength = "signal_strength",
  /**
   * Sound pressure in dB or dBA
   */
  sound_pressure = "sound_pressure",
  /**
   * Generic speed in ft/s, in/d, in/h, km/h, kn, m/s, mph, or mm/d
   */
  speed = "speed",
  /**
   * Concentration of sulphur dioxide in µg/m³
   */
  sulphur_dioxide = "sulphur_dioxide",
  /**
   * Temperature in °C or °F
   */
  temperature = "temperature",
  /**
   * Datetime object or timestamp string (ISO 8601)
   */
  timestamp = "timestamp",
  /**
   * Concentration of volatile organic compounds in µg/m³
   */
  volatile_organic_compounds = "volatile_organic_compounds",
  /**
   * Voltage in V
   */
  voltage = "voltage",
  /**
   * Generic volume in L, mL, gal, fl. oz., m³, or ft³
   */
  volume = "volume",
  /**
   * Water consumption in L, gal, m³, or ft³
   */
  water = "water",
  /**
   * Generic mass in kg, g, mg, µg, oz, or lb
   */
  weight = "weight",
  /**
   * Wind speed in ft/s, km/h, kn, m/s, or mph
   */
  wind_speed = "wind_speed",
}

type DurationSensor = {
  device_class: "duration";
  unit_of_measurement: "h" | "min" | "s" | "d";
};
type TemperatureSensor = {
  device_class: "temperature";
  unit_of_measurement: "K" | "°C" | "°F";
};
type Precipitation = {
  device_class: "precipitation";
  unit_of_measurement: "cm" | "in" | "mm";
};
type ApparentPowerSensor = {
  device_class: "apparent_power";
  unit_of_measurement: "VA";
};
type WaterSensor = {
  device_class: "water";
  unit_of_measurement: "L" | "gal" | "m³" | "ft³" | "CCF";
};
type WeightSensor = {
  device_class: "weight";
  unit_of_measurement: "kg" | "g" | "mg" | "µg" | "oz" | "lb" | "st";
};
type WindSpeedSensor = {
  device_class: "wind_speed";
  unit_of_measurement: "ft/s" | "km/h" | "kn" | "m/s" | "mph";
};
type SpeedSensor = {
  device_class: "speed";
  unit_of_measurement:
    | "ft/s"
    | "in/d"
    | "in/h"
    | "km/h"
    | "kn"
    | "m/s"
    | "mph"
    | "mm/d";
};
type VoltageSensor = {
  device_class: "voltage";
  unit_of_measurement: "V" | "mV";
};
type SignalStrengthSensor = {
  device_class: "signal_strength";
  unit_of_measurement: "dB" | "dBm";
};
type VolumeSensor = {
  device_class: "volume";
  unit_of_measurement: "L" | "mL" | "gal" | "fl. oz." | "m³" | "ft³" | "CCF";
};
type SoundPressureSensor = {
  device_class: "sound_pressure";
  unit_of_measurement: "dB" | "dBA";
};
type PressureSensor = {
  device_class: "pressure";
  unit_of_measurement:
    | "cbar"
    | "bar"
    | "hPa"
    | "inHg"
    | "kPa"
    | "mbar"
    | "Pa"
    | "psi";
};
type ReactivePowerSensor = {
  device_class: "reactive_power";
  unit_of_measurement: "var";
};
type PrecipitationIntensitySensor = {
  device_class: "precipitation_intensity";
  unit_of_measurement: "in/d" | "in/h" | "mm/d" | "mm/h";
};
type PowerFactorSensor = {
  device_class: "power_factor";
  unit_of_measurement: "%" | "None";
};
type PowerSensor = {
  device_class: "power";
  unit_of_measurement: "W" | "kW";
};
type MixedGasSensor = {
  device_class:
    | "nitrogen_monoxide"
    | "nitrous_oxide"
    | "ozone"
    | "pm1"
    | "pm25"
    | "pm10"
    | "volatile_organic_compounds";
  unit_of_measurement: "µg/m³";
};
type IlluminanceSensor = {
  device_class: "illuminance";
  unit_of_measurement: "lx";
};
type IrradianceSensor = {
  device_class: "irradiance";
  unit_of_measurement: "W/m²" | "BTU/(h⋅ft²)";
};
type GasSensor = {
  device_class: "gas";
  unit_of_measurement: "m³" | "ft³" | "CCF";
};
type FrequencySensor = {
  device_class: "frequency";
  unit_of_measurement: "Hz" | "kHz" | "MHz" | "GHz";
};
type EnergySensor = {
  device_class: "energy";
  unit_of_measurement: "Wh" | "kWh" | "MWh" | "MJ" | "GJ";
};
type DistanceSensor = {
  device_class: "distance";
  unit_of_measurement: "km" | "m" | "cm" | "mm" | "mi" | "yd" | "in";
};
type MonetarySensor = {
  device_class: "monetary";
  /**
   * https://en.wikipedia.org/wiki/ISO_4217#Active_codes
   */
  unit_of_measurement: string;
};
type DataRateSensor = {
  device_class: "data_rate";
  unit_of_measurement:
    | "bit/s"
    | "kbit/s"
    | "Mbit/s"
    | "Gbit/s"
    | "B/s"
    | "kB/s"
    | "MB/s"
    | "GB/s"
    | "KiB/s"
    | "MiB/s"
    | "GiB/s";
};
type DataSizeSensor = {
  device_class: "data_size";
  unit_of_measurement:
    | "bit"
    | "kbit"
    | "Mbit"
    | "Gbit"
    | "B"
    | "kB"
    | "MB"
    | "GB"
    | "TB"
    | "PB"
    | "EB"
    | "ZB"
    | "YB"
    | "KiB"
    | "MiB"
    | "GiB"
    | "TiB"
    | "PiB"
    | "EiB"
    | "ZiB"
    | "YiB";
};
type AtmosphericPressureSensor = {
  device_class: "atmospheric_pressure";
  unit_of_measurement:
    | "cbar"
    | "bar"
    | "hPa"
    | "inHg"
    | "kPa"
    | "mbar"
    | "Pa"
    | "psi";
};
type CurrentSensor = {
  device_class: "current";
  unit_of_measurement: "A" | "mA";
};
type CarbonSensor = {
  device_class: "carbon_dioxide" | "carbon_monoxide";
  unit_of_measurement: "ppm";
};
type PercentSensor = {
  device_class: "battery" | "humidity" | "moisture";
  unit_of_measurement: "%";
};
type DefaultSensor = {
  /**
   * The type/class of the sensor to set the icon in the frontend.
   *
   * @see https://www.home-assistant.io/integrations/sensor/#device-class
   */
  device_class?: "timestamp" | "date" | "aqi" | "enum";
  unit_of_measurement?: void;
};

export type SensorDeviceClasses =
  | DurationSensor
  | TemperatureSensor
  | Precipitation
  | ApparentPowerSensor
  | WaterSensor
  | WeightSensor
  | WindSpeedSensor
  | SpeedSensor
  | VoltageSensor
  | SignalStrengthSensor
  | VolumeSensor
  | SoundPressureSensor
  | PressureSensor
  | ReactivePowerSensor
  | PowerFactorSensor
  | PowerSensor
  | PrecipitationIntensitySensor
  | MixedGasSensor
  | IlluminanceSensor
  | IrradianceSensor
  | PercentSensor
  | GasSensor
  | FrequencySensor
  | EnergySensor
  | DistanceSensor
  | MonetarySensor
  | DataRateSensor
  | CurrentSensor
  | CarbonSensor
  | DataSizeSensor
  | AtmosphericPressureSensor
  | DefaultSensor;

// type ValueTypes = "number" | "date" | "string";

// private valueType(deviceClass: string): ValueTypes {
//   switch (deviceClass) {
//     case "current":
//     case "duration":
//     case "temperature":
//     case "precipitation":
//     case "apparent_power":
//     case "water":
//     case "weight":
//     case "wind_speed":
//     case "speed":
//     case "voltage":
//     case "signal_strength":
//     case "volume":
//     case "sound_pressure":
//     case "pressure":
//     case "reactive_power":
//     case "precipitation_intensity":
//     case "power_factor":
//     case "power":
//     case "nitrogen_monoxide":
//     case "nitrous_oxide":
//     case "ozone":
//     case "pm1":
//     case "pm25":
//     case "pm10":
//     case "volatile_organic_compounds":
//     case "illuminance":
//     case "irradiance":
//     case "gas":
//     case "frequency":
//     case "energy":
//     case "distance":
//     case "monetary":
//     case "data_rate":
//     case "data_size":
//     case "atmospheric_pressure":
//     case "carbon_dioxide":
//     case "carbon_monoxide":
//     case "battery":
//     case "humidity":
//     case "moisture":
//       return "number";
//     case "timestamp":
//     case "date":
//       return "date";
//     default:
//       return "string";
//   }
// }
