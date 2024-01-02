import { is } from "@zcc/utilities";
import { MergeExclusive } from "type-fest";

/**
 * Defines the types of parameters that can be used in fetch requests.
 */
export type FetchParameterTypes =
  | string
  | boolean
  | Date
  | number
  | Array<string | Date | number>;

/**
 * via undici, with undefined added
 */
export type BodyInit =
  | ArrayBuffer
  | AsyncIterable<Uint8Array>
  | Blob
  | FormData
  | Iterable<Uint8Array>
  | NodeJS.ArrayBufferView
  | URLSearchParams
  | null
  | undefined
  | string;

/**
 * Enumerates HTTP methods used in fetch requests.
 */
export enum HTTP_METHODS {
  get = "get",
  delete = "delete",
  put = "put",
  patch = "patch",
  post = "post",
}

type NoBodyMethods = "get" | "delete";
type BodyMethods = "put" | "patch" | "post";

/**
 * Represents a fetch request with additional properties and body content.
 */
export type FetchWith<
  EXTRA extends Record<never, string> = Record<never, string>,
  BODY extends BodyInit = undefined,
> = Partial<FetchArguments<BODY>> & EXTRA;

export type FetchProcessTypes = boolean | "text" | "json" | "raw" | undefined;

type BaseFetchArguments = {
  /**
   * Headers to append
   */
  headers?: Record<string, string>;
  /**
   * Query params to send
   */
  params?: Record<string, FetchParameterTypes>;
  /**
   * Built in post-processing
   *
   * - true / "json" = attempt to decode as json
   * - false / "raw" = return the node-fetch response object without processing
   * - "text" = return result as text, no additional processing
   *
   * ? boolean values are deprecated
   */
  process?: FetchProcessTypes;
};

type BaseFetchUrl = {
  /**
   * URL to send request to
   */
  url: string;
} & MergeExclusive<
  {
    /**
     * Frequently filled in by wrapper services
     */
    baseUrl?: string;
  },
  {
    /**
     * URL is the full path (includes http://...)
     *
     * Ignores baseUrl if set
     */
    rawUrl?: boolean;
  }
>;

type BaseFetchBody<BODY extends BodyInit = undefined> = MergeExclusive<
  {
    /**
     * POSTDATA
     */
    body?: BODY;
    /**
     * HTTP method
     */
    method: BodyMethods;
  },
  {
    /**
     * HTTP method
     */
    method?: NoBodyMethods;
  }
>;

/**
 * Defines the structure and types for arguments passed to fetch requests.
 */
export type FetchArguments<BODY extends BodyInit = undefined> = BaseFetchUrl &
  BaseFetchArguments &
  BaseFetchBody<BODY>;

/**
 * Represents a subset of FetchArguments for specific use cases.
 */
export type FilteredFetchArguments<BODY extends BodyInit = undefined> =
  BaseFetchBody<BODY> &
    Pick<BaseFetchUrl, "url"> &
    Pick<BaseFetchArguments, "process" | "params">;

/**
 * Same thing as FetchWith, but the function doesn't need any args
 *
 * This is a work around, for some reason the default value approach isn't work as I had hoped
 */
export type BaseFetch = Partial<FetchArguments>;

/**
 * Defines the types of values that can be used in filter operations.
 */
export type FilterValueType =
  | string
  | boolean
  | number
  | Date
  | RegExp
  | unknown
  | Record<string, string>;

/**
 * Enumerates the types of operations available for data filtering.
 */
export enum FILTER_OPERATIONS {
  // "elemMatch" functionality in mongo
  // eslint-disable-next-line unicorn/prevent-abbreviations
  elem = "elem",
  regex = "regex",
  in = "in",
  nin = "nin",
  lt = "lt",
  lte = "lte",
  gt = "gt",
  gte = "gte",
  exists = "exists",
  empty = "empty",
  ne = "ne",
  eq = "eq",
}

export interface ComparisonDTO {
  operation?: FILTER_OPERATIONS | `${FILTER_OPERATIONS}`;
  value?: FilterValueType | FilterValueType[];
}

export interface Filter<FIELDS = string> extends ComparisonDTO {
  empty?: boolean;
  exists?: boolean;
  field?: FIELDS;
}

export interface ResultControl {
  filters?: Set<Filter>;
  limit?: number;
  select?: string[];
  skip?: number;
  sort?: string[];
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function controlToQuery(
  value: Readonly<ResultControl>,
): Record<string, string> {
  const out = new Map<string, string>();
  if (value?.limit) {
    out.set("limit", value.limit.toString());
  }
  if (value?.skip) {
    out.set("skip", value.skip.toString());
  }
  if (value?.sort) {
    out.set("sort", value.sort.join(","));
  }
  if (value?.select) {
    out.set("select", value.select.join(","));
  }
  value?.filters?.forEach(f => {
    let field = f.field;
    if (f.operation && f.operation !== FILTER_OPERATIONS.eq) {
      field = `${field}__${f.operation}`;
    }
    let value = f.value;
    if (is.array(value)) {
      value = value.join(",");
    }
    if (value instanceof Date) {
      value = value.toISOString();
    }
    if (value === null) {
      value = "null";
    }
    if (field) {
      out.set(field, (value ?? "").toString());
    }
  });
  return Object.fromEntries(out.entries());
}

export function buildFilter(
  key: string,
  value: FilterValueType | FilterValueType[],
): Filter {
  const [name, operation] = key.split("__") as [string, FILTER_OPERATIONS];
  switch (operation) {
    case "in":
    case "nin":
      if (!is.array(value)) {
        value = is.string(value) ? value.split(",") : [value];
      }
      return {
        field: name,
        operation,
        value: value,
      };
    case "elem":
      return {
        field: name,
        operation,
        value: is.string(value) ? JSON.parse(value) : value,
      };
    default:
      return {
        field: name,
        operation,
        value,
      };
  }
}

export function queryToControl(
  value: Readonly<Record<string, string>>,
): ResultControl {
  const filters = new Set<Filter<string>>();
  const out: ResultControl = { filters };
  const parameters = new Map<string, string>(Object.entries(value));
  parameters.forEach((value, key) => {
    const [name, operation] = key.split("__") as [string, FILTER_OPERATIONS];
    switch (key) {
      case "select":
        out.select = value.split(",");
        return;
      case "sort":
        out.sort = value.split(",");
        return;
      case "limit":
        out.limit = Number(value);
        return;
      case "skip":
        out.skip = Number(value);
        return;
    }
    switch (operation) {
      case "in":
      case "nin":
        filters.add({
          field: name,
          operation,
          value: value.split(","),
        });
        return;
      case "elem":
        filters.add({
          field: name,
          operation,
          value: JSON.parse(value),
        });
        return;
      default:
        filters.add({
          field: name,
          operation,
          value,
        });
    }
  });
  return out;
}
