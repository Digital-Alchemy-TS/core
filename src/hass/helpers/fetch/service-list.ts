export interface ServiceListSelectorTarget {
  domain?: string;
  integration?: string;
}
export interface ServiceListSelector {
  boolean?: null;
  entity?: ServiceListSelectorTarget;
  number?: {
    max: number;
    min: number;
    mode?: string;
    step?: number;
    unit_of_measurement: string;
  };
  object?: null;
  select?: {
    options: Record<"label" | "value", string>[] | string[];
  };
  text?: null;
  time?: null;
}

export interface ServiceListFieldDescription {
  advanced?: boolean;
  default?: unknown;
  description?: string;
  example?: string | number;
  name?: string;
  required?: boolean;
  selector?: ServiceListSelector;
}

export type ServiceListEntityTarget = {
  domain?: string[];
  supported_features?: number[];
};

export interface ServiceListServiceTarget {
  device?: { integration?: string };
  entity?: ServiceListEntityTarget[];
  integration?: string;
}

export interface ServiceListField {
  description?: string;
  fields: Record<string, ServiceListFieldDescription>;
  name?: string;
  target?: ServiceListServiceTarget;
}

export interface HassServiceDTO {
  domain: string;
  services: Record<string, ServiceListField>;
}
