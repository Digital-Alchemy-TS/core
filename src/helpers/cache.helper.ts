import { TServiceParams } from ".";

export type CacheDriverOptions = Pick<
  TServiceParams,
  "logger" | "config" | "lifecycle"
>;

export interface ICacheDriver {
  get<T>(key: string, defaultValue?: T): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl: number): Promise<void>;
  del(key: string): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
}

export type TCache = {
  del: (key: string) => Promise<void>;
  get: <T>(key: string, defaultValue?: T) => Promise<T>;
  set: <T>(key: string, value: T, ttl?: number) => Promise<void>;
  keys: (pattern?: string) => Promise<string[]>;
  setClient: (client: ICacheDriver) => void;
};

export enum CacheProviders {
  redis = "redis",
  memory = "memory",
}
