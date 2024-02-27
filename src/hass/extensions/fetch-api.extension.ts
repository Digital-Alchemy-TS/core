import dayjs from "dayjs";

import {
  DOWN,
  FilteredFetchArguments,
  is,
  NO_CHANGE,
  SECOND,
  TDownload,
  TFetch,
  TFetchBody,
  TServiceParams,
  UP,
  ZCC,
} from "../..";
import {
  CalendarEvent,
  CalendarFetchOptions,
  CheckConfigResult,
  ENTITY_STATE,
  HassConfig,
  HassServiceDTO,
  HomeAssistantServerLogItem,
  PICK_ENTITY,
  PICK_SERVICE,
  PICK_SERVICE_PARAMETERS,
  PostConfigPriorities,
  RawCalendarEvent,
} from "..";

type SendBody<
  STATE extends string | number = string,
  ATTRIBUTES extends object = object,
> = {
  attributes?: ATTRIBUTES;
  state?: STATE;
};

export function FetchAPI({
  logger,
  lifecycle,
  context,
  config,
}: TServiceParams) {
  let fetcher: TFetch;
  let downloader: TDownload;

  // Load configurations
  lifecycle.onPostConfig(() => {
    const fetch = ZCC.createFetcher({
      baseUrl: config.hass.BASE_URL,
      context,
      headers: { Authorization: `Bearer ${config.hass.TOKEN}` },
    });
    fetcher = fetch.fetch;
    downloader = fetch.download;
  }, PostConfigPriorities.FETCH);

  async function calendarSearch({
    calendar,
    start = dayjs(),
    end,
  }: CalendarFetchOptions): Promise<CalendarEvent[]> {
    if (Array.isArray(calendar)) {
      const list = await Promise.all(
        calendar.map(
          async (cal) => await calendarSearch({ calendar: cal, end, start }),
        ),
      );
      return list
        .flat()
        .sort((a, b) =>
          a.start.isSame(b.start)
            ? NO_CHANGE
            : a.start.isAfter(b.start)
              ? UP
              : DOWN,
        );
    }

    const params = { end: end.toISOString(), start: start.toISOString() };
    const events = await fetcher<RawCalendarEvent[]>({
      params,
      url: `/api/calendars/${calendar}`,
    });
    logger.trace(
      { ...params },
      `%s search found %s events`,
      calendar,
      events.length,
    );
    return events.map(({ start, end, ...extra }) => ({
      ...extra,
      end: dayjs(end.dateTime),
      start: dayjs(start.dateTime),
    }));
  }

  async function callService<SERVICE extends PICK_SERVICE>(
    serviceName: SERVICE,
    data: PICK_SERVICE_PARAMETERS<SERVICE>,
  ): Promise<ENTITY_STATE<PICK_ENTITY>[]> {
    const [domain, service] = serviceName.split(".");
    return await fetcher({
      body: data as TFetchBody,
      method: "post",
      url: `/api/services/${domain}/${service}`,
    });
  }

  async function checkConfig(): Promise<CheckConfigResult> {
    logger.trace(`check config`);
    return await fetcher({
      method: `post`,
      url: `/api/config/core/check_config`,
    });
  }

  async function download(
    destination: string,
    fetchWith: FilteredFetchArguments,
  ): Promise<void> {
    await downloader({
      ...fetchWith,
      baseUrl: config.hass.BASE_URL,
      destination,
      headers: { Authorization: `Bearer ${config.hass.TOKEN}` },
    });
  }

  async function fetchEntityCustomizations<
    T extends Record<never, unknown> = Record<
      "global" | "local",
      Record<string, string>
    >,
  >(entityId: string | string[]): Promise<T> {
    return await fetcher<T>({
      url: `/api/config/customize/config/${entityId}`,
    });
  }

  async function fetchEntityHistory<
    ENTITY extends PICK_ENTITY = PICK_ENTITY,
    T extends ENTITY_STATE<ENTITY> = ENTITY_STATE<ENTITY>,
  >(
    entity_id: ENTITY,
    from: Date,
    to: Date,
    extra: { minimal_response?: "" } = {},
  ): Promise<T[]> {
    logger.info(
      { entity_id, from: from.toISOString(), to: to.toISOString() },
      `fetch entity history`,
    );
    const result = await fetcher<[T[]]>({
      params: {
        end_time: to.toISOString(),
        filter_entity_id: entity_id,
        ...extra,
      },
      url: `/api/history/period/${from.toISOString()}`,
    });
    if (!Array.isArray(result)) {
      logger.error({ result }, `unexpected return result`);
      return [];
    }
    const [out] = result;
    return out;
  }

  async function fireEvent<DATA extends TFetchBody = object>(
    event: string,
    data?: DATA,
  ): Promise<void> {
    logger.trace({ name: event, ...data }, `Firing event`);
    const response = await fetcher<{ message: string }>({
      // body: data,
      body: {},
      method: "post",
      url: `/api/events/${event}`,
    });
    if (response?.message !== `Event ${event} fired.`) {
      logger.debug({ response }, `unexpected response from firing event`);
    }
  }

  async function getAllEntities(): Promise<ENTITY_STATE<PICK_ENTITY>[]> {
    logger.trace(`get all entities`);
    return await fetcher<ENTITY_STATE<PICK_ENTITY>[]>({ url: `/api/states` });
  }

  async function getHassConfig(): Promise<HassConfig> {
    logger.trace(`get config`);
    return await fetcher({ url: `/api/config` });
  }

  async function getLogs(): Promise<HomeAssistantServerLogItem[]> {
    logger.trace(`get logs`);
    const results = await fetcher<HomeAssistantServerLogItem[]>({
      url: `/api/error/all`,
    });
    return results.map((i) => {
      i.timestamp = Math.floor(i.timestamp * SECOND);
      i.first_occurred = Math.floor(i.first_occurred * SECOND);
      return i;
    });
  }

  async function getRawLogs(): Promise<string> {
    logger.trace(`get raw logs`);
    return await fetcher<string>({ process: "text", url: `/api/error_log` });
  }

  async function listServices(): Promise<HassServiceDTO[]> {
    logger.trace(`list services`);
    return await fetcher<HassServiceDTO[]>({ url: `/api/services` });
  }

  async function updateEntity<
    STATE extends string | number = string,
    ATTRIBUTES extends object = object,
  >(
    entity_id: PICK_ENTITY,
    { attributes, state }: SendBody<STATE, ATTRIBUTES>,
  ): Promise<void> {
    const body: SendBody<STATE> = {};
    if (state !== undefined) {
      body.state = state;
    }
    if (!is.empty(attributes)) {
      body.attributes = attributes;
    }
    logger.trace({ ...body, name: entity_id }, `set entity state`);
    await fetcher({ body, method: "post", url: `/api/states/${entity_id}` });
  }

  async function webhook(name: string, data: object = {}): Promise<void> {
    logger.trace({ ...data, name }, `webhook`);
    await fetcher({
      body: data,
      method: "post",
      process: "text",
      url: `/api/webhook/${name}`,
    });
  }

  async function checkCredentials(): Promise<{ message: string } | string> {
    logger.trace(`check credentials`);
    return await fetcher({
      url: `/api/`,
    });
  }

  return {
    calendarSearch,
    callService,
    checkConfig,
    checkCredentials,
    download,
    fetch: fetcher,
    fetchEntityCustomizations,
    fetchEntityHistory,
    fireEvent,
    getAllEntities,
    getConfig: getHassConfig,
    getLogs,
    getRawLogs,
    listServices,
    updateEntity,
    webhook,
  };
}
