export interface HassUnitSystem {
  length: "mi";
  mass: "lb";
  pressure: "psi";
  temperature: "°F";
  volume: "gal";
}

export interface HassConfig {
  allowlist_external_dirs: string[];
  allowlist_external_urls: string[];
  components: string[];
  config_dir: string;
  config_source: string;
  currency: string;
  elevation: number;
  external_url: string;
  internal_url: string;
  latitude: number;
  location_name: string;
  longitude: number;
  safe_mode: string;
  state: string;
  time_zone: string;
  unit_system: HassUnitSystem;
  version: string;
  whitelist_external_dirs: string[];
}

export type CheckConfigResult =
  | {
      errors: null;
      result: "valid";
    }
  | {
      errors: string;
      result: "invalid";
    };
