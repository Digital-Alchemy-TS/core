import { createWriteStream } from "fs";
import { pipeline } from "stream";
import { promisify } from "util";

import {
  buildFilterString,
  DownloadOptions,
  FetchArguments,
  FetcherOptions,
  FetchProcessTypes,
  FetchRequestError,
  FetchWith,
  FIRST,
  MaybeHttpError,
  TFetchBody,
  TServiceParams,
} from "..";
import { is } from ".";

const streamPipeline = promisify(pipeline);
const MS_PRECISION = 2;

export function Fetch({ logger, context: parentContext }: TServiceParams) {
  return ({
    headers: base_headers,
    baseUrl: base_url,
    context: logContext,
    // eslint-disable-next-line sonarjs/cognitive-complexity
  }: FetcherOptions) => {
    const capabilities: string[] = [];

    if (!is.empty(capabilities)) {
      logger.trace({ capabilities, name: logContext }, `initialized fetcher`);
    }

    function checkForHttpErrors<T extends unknown = unknown>(
      maybeError: MaybeHttpError,
    ): T {
      if (
        is.object(maybeError) &&
        maybeError !== null &&
        is.number(maybeError.statusCode) &&
        is.string(maybeError.error)
      ) {
        // Log the error if needed
        logger.error(
          { error: maybeError, name: logContext },
          maybeError.message,
        );

        // Throw a FetchRequestError
        // throw new FetchRequestError(maybeError);
        throw new FetchRequestError(
          logContext || parentContext,
          maybeError.statusCode,
          maybeError.error,
          maybeError.message,
        );
      }

      return maybeError as T;
    }

    // #MARK: fetchHandleResponse
    async function fetchHandleResponse<T extends unknown = unknown>(
      process: FetchProcessTypes,
      response: Response,
    ): Promise<T> {
      if (process === false || process === "raw") {
        return response as T;
      }
      const text = await response.text();
      if (process === "text") {
        return text as unknown as T;
      }
      if (!["{", "["].includes(text.charAt(FIRST))) {
        if (["OK"].includes(text)) {
          logger.debug({ name: logContext, text }, "full response text");
        } else {
          // It's probably a coding error error, and not something a user did.
          // Will try to keep the array up to date if any other edge cases pop up
          logger.warn({ name: logContext, text }, `unexpected api Response`);
        }
        return text as T;
      }
      const parsed = JSON.parse(text);
      return checkForHttpErrors<T>(parsed);
    }

    function fetchCreateUrl({ rawUrl, url, ...fetchWith }: FetchWith): string {
      let out = url || "";
      if (!rawUrl) {
        const base = fetchWith.baseUrl || fetchWrapper.base_url;
        out = base + url;
      }
      if (!is.empty(fetchWith.params)) {
        out = `${out}?${buildFilterString(fetchWith)}`;
      }
      return out;
    }

    // #MARK: execFetch
    async function execFetch<T, BODY extends TFetchBody = undefined>({
      body,
      headers = {},
      method = "get",
      process,
      context = logContext || parentContext,
      ...fetchWith
    }: Partial<FetchArguments<BODY>>) {
      const contentType = is.object(body)
        ? { "Content-Type": "application/json" }
        : {};

      const start = performance.now();
      const result = await fetch(fetchCreateUrl(fetchWith), {
        body: is.object(body) ? JSON.stringify(body) : body,
        headers: {
          ...contentType,
          ...fetchWrapper.base_headers,
          ...headers,
        },
        method,
      });
      const ms = Number((performance.now() - start).toFixed(MS_PRECISION));
      logger.trace({ context, ms }, "request complete");
      return await fetchHandleResponse<T>(process, result);
    }

    async function download({
      destination,
      body,
      headers = {},
      context = logContext || parentContext,
      method = "get",
      ...fetchWith
    }: DownloadOptions) {
      const start = performance.now();
      const url: string = await fetchCreateUrl(fetchWith);
      const response = await fetch(url, {
        body: is.object(body) ? JSON.stringify(body) : body,
        headers: { ...fetchWrapper.base_headers, ...headers },
        method,
      });

      const stream = createWriteStream(destination);
      await streamPipeline(response.body, stream);
      const ms = Number((performance.now() - start).toFixed(MS_PRECISION));
      logger.trace({ context, ms }, "download complete");
    }

    // #MARK: return object
    const fetchWrapper = {
      base_headers,
      base_url,
      download,
      fetch: execFetch,
      /**
       * @deprecated set base_url directly
       */
      setBaseUrl: (url: string) => (fetchWrapper.base_url = url),
      /**
       * @deprecated set base_headers directly
       */
      setHeaders: (headers: Record<string, string>) =>
        (fetchWrapper.base_headers = headers),
    };
    return fetchWrapper;
  };
}

export type TFetch = <T, BODY extends object = object>(
  fetchWith: Partial<FetchArguments<BODY>>,
) => Promise<T>;

export type TDownload = (fetchWith: DownloadOptions) => Promise<void>;
