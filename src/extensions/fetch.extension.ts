import { createWriteStream } from "fs";
import { pipeline } from "stream";
import { promisify } from "util";

import {
  buildFilterString,
  DownloadOptions,
  FETCH_DOWNLOAD_REQUESTS_SUCCESSFUL,
  FETCH_REQUESTS_FAILED,
  FETCH_REQUESTS_SUCCESSFUL,
  FetchArguments,
  FetcherOptions,
  FetchProcessTypes,
  FetchRequestError,
  FetchWith,
  FIRST,
  MaybeHttpError,
  TContext,
  TFetchBody,
  TServiceParams,
} from "..";
import { is } from ".";

const streamPipeline = promisify(pipeline);

export function Fetch({ logger, context: parentContext }: TServiceParams) {
  return ({
    headers: baseHeaders,
    baseUrl,
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
        const base = fetchWith.baseUrl || baseUrl;
        out = base + url;
      }
      if (!is.empty(fetchWith.params)) {
        out = `${out}?${buildFilterString(fetchWith)}`;
      }
      return out;
    }

    async function MeasureRequest<T>(
      label: string,
      context: TContext,
      exec: () => Promise<T>,
    ): Promise<T> {
      try {
        const out = await exec();
        if (!is.empty(label)) {
          FETCH_REQUESTS_SUCCESSFUL.labels(context, label).inc();
        }
        return out;
      } catch (error) {
        logger.error({ error, name: logContext }, `request failed`);
        if (!is.empty(label)) {
          FETCH_REQUESTS_FAILED.labels(context, label).inc();
        }
        throw error;
      }
    }

    async function execFetch<T, BODY extends TFetchBody = undefined>({
      body,
      headers = {},
      method = "get",
      process,
      label,
      context = logContext || parentContext,
      ...fetchWith
    }: Partial<FetchArguments<BODY>>) {
      const out = await MeasureRequest(label, context, async () => {
        const contentType = is.object(body)
          ? { "Content-Type": "application/json" }
          : {};
        const result = await fetch(fetchCreateUrl(fetchWith), {
          body: is.object(body) ? JSON.stringify(body) : body,
          headers: {
            ...contentType,
            ...baseHeaders,
            ...headers,
          },
          method,
        });
        return await fetchHandleResponse<T>(process, result);
      });
      FETCH_REQUESTS_SUCCESSFUL.labels(context, label).inc();
      return out;
    }

    return {
      download: async ({
        destination,
        body,
        headers = {},
        label,
        context = logContext || parentContext,
        method = "get",
        ...fetchWith
      }: DownloadOptions) => {
        const url: string = await fetchCreateUrl(fetchWith);
        const response = await fetch(url, {
          body: is.object(body) ? JSON.stringify(body) : body,
          headers: {
            ...baseHeaders,
            ...headers,
          },
          method,
        });

        const stream = createWriteStream(destination);
        await streamPipeline(response.body, stream);
        if (!is.empty(label)) {
          FETCH_DOWNLOAD_REQUESTS_SUCCESSFUL.labels(context, label).inc();
        }
      },
      fetch: async <T, BODY extends TFetchBody = undefined>(
        fetchWith: Partial<FetchArguments<BODY>>,
      ): Promise<T | undefined> => await execFetch(fetchWith),
      setBaseUrl: (url: string) => (baseUrl = url),
      setHeaders: (headers: Record<string, string>) => (baseHeaders = headers),
    };
  };
}

export type TFetch = <T, BODY extends object = object>(
  fetchWith: Partial<FetchArguments<BODY>>,
) => Promise<T>;

export type TDownload = (fetchWith: DownloadOptions) => Promise<void>;
