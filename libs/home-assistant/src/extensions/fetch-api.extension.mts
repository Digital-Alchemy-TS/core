import { TFetch, TFetchBody, TServiceParams } from "@zcc/boilerplate";
import { DOWN, is, NO_CHANGE, SECOND, UP, ZCC } from "@zcc/utilities";
import dayjs from "dayjs";

import {
  HASS_CALENDAR_SEARCH,
  HASS_CALL_SERVICE,
  HASS_SEND_WEBHOOK,
} from "../helpers/dynamic.helper.mjs";
import { GenericEntityDTO } from "../helpers/types/entity-state.helper.mjs";
import {
  CalendarEvent,
  CalendarFetchOptions,
  RawCalendarEvent,
} from "../helpers/types/fetch/calendar.mjs";
import {
  CheckConfigResult,
  HassConfig,
} from "../helpers/types/fetch/configuration.mjs";
import { HomeAssistantServerLogItem } from "../helpers/types/fetch/index.mjs";
import { HassServiceDTO } from "../helpers/types/fetch/service-list.mjs";
import {
  ENTITY_STATE,
  PICK_ENTITY,
  PICK_SERVICE,
  PICK_SERVICE_PARAMETERS,
} from "../helpers/types/utility.helper.mjs";
import { BASE_URL, TOKEN } from "../index.mjs";

type SendBody<
  STATE extends string | number = string,
  ATTRIBUTES extends object = object,
> = {
  attributes?: ATTRIBUTES;
  state?: STATE;
};

export function HAFetchAPI({
  logger,
  getConfig,
  lifecycle,
  context,
}: TServiceParams) {
  let baseUrl: string;
  let token: string;
  let fetch: TFetch;

  // Load configurations
  lifecycle.onPostConfig(() => {
    token = getConfig<string>(TOKEN);
    baseUrl = getConfig<string>(BASE_URL);
    fetch = ZCC.createFetcher({
      baseUrl,
      context,
      headers: { Authorization: `Bearer ${token}` },
    }).fetch;
    logger.trace(`Load configuration`);
  });

  async function calendarSearch({
    calendar,
    start = dayjs(),
    end,
  }: CalendarFetchOptions): Promise<CalendarEvent[]> {
    if (Array.isArray(calendar)) {
      const list = await Promise.all(
        calendar.map(
          async cal => await calendarSearch({ calendar: cal, end, start }),
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
    const events = await fetch<RawCalendarEvent[]>({
      params,
      url: `/api/calendars/${calendar}`,
    });
    logger.trace(
      { ...params },
      `[%s] search found {%s} events`,
      calendar,
      events.length,
    );
    ZCC.event.emit(HASS_CALENDAR_SEARCH);
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
    ZCC.event.emit(HASS_CALL_SERVICE, { domain, service, type: "fetch" });
    return await fetch({
      body: data as TFetchBody,
      method: "post",
      url: `/api/services/${domain}/${service}`,
    });
  }

  async function checkConfig(): Promise<CheckConfigResult> {
    logger.trace(`Check config`);
    return await fetch({
      method: `post`,
      url: `/api/config/core/check_config`,
    });
  }

  // async function download(
  //   destination: string,
  //   fetchWith: FilteredFetchArguments,
  // ): Promise<void> {
  //   await ZCC.fetch.download({
  //     ...fetchWith,
  //     baseUrl,
  //     destination,
  //     headers: { Authorization: `Bearer ${token}` },
  //   });
  // }

  async function fetchEntityCustomizations<
    T extends Record<never, unknown> = Record<
      "global" | "local",
      Record<string, string>
    >,
  >(entityId: string | string[]): Promise<T> {
    return await fetch<T>({ url: `/api/config/customize/config/${entityId}` });
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
      { from: from.toISOString(), to: to.toISOString() },
      `[${entity_id}] Fetch entity history`,
    );
    const result = await fetch<[T[]]>({
      params: {
        end_time: to.toISOString(),
        filter_entity_id: entity_id,
        ...extra,
      },
      url: `/api/history/period/${from.toISOString()}`,
    });
    if (!Array.isArray(result)) {
      logger.error({ result }, `Unexpected return result`);
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
    const response = await fetch<{ message: string }>({
      // body: data,
      body: {},
      method: "post",
      url: `/api/events/${event}`,
    });
    if (response?.message !== `Event ${event} fired.`) {
      logger.debug({ response }, `Unexpected response from firing event`);
    }
  }

  async function getAllEntities(): Promise<GenericEntityDTO[]> {
    logger.trace(`Get all entities`);
    return await fetch<GenericEntityDTO[]>({ url: `/api/states` });
  }

  async function getHassConfig(): Promise<HassConfig> {
    logger.trace(`Get config`);
    return await fetch({ url: `/api/config` });
  }

  async function getLogs(): Promise<HomeAssistantServerLogItem[]> {
    logger.trace(`Get logs`);
    const results = await fetch<HomeAssistantServerLogItem[]>({
      url: `/api/error/all`,
    });
    return results.map(i => {
      i.timestamp = Math.floor(i.timestamp * SECOND);
      i.first_occurred = Math.floor(i.first_occurred * SECOND);
      return i;
    });
  }

  async function getRawLogs(): Promise<string> {
    logger.trace(`Get raw logs`);
    return await fetch<string>({ process: "text", url: `/api/error_log` });
  }

  async function listServices(): Promise<HassServiceDTO[]> {
    logger.trace(`List services`);
    return await fetch<HassServiceDTO[]>({ url: `/api/services` });
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
    logger.trace({ ...body, name: entity_id }, `Set entity state`);
    await fetch({ body, method: "post", url: `/api/states/${entity_id}` });
  }

  async function webhook(name: string, data: object = {}): Promise<void> {
    logger.trace({ ...data, name }, `Webhook`);
    ZCC.event.emit(HASS_SEND_WEBHOOK, { name });
    await fetch({
      body: data,
      method: "post",
      process: "text",
      url: `/api/webhook/${name}`,
    });
  }

  const out: THAFetchAPI = {
    calendarSearch,
    callService,
    checkConfig,
    // download,
    fetch,
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

  ZCC.hass.fetch = out;
  return out;
}

export type THAFetchAPI = {
  calendarSearch: ({
    calendar,
    start,
    end,
  }: CalendarFetchOptions) => Promise<CalendarEvent[]>;
  callService: <SERVICE extends `${string}.${string}`>(
    serviceName: SERVICE,
    data: PICK_SERVICE_PARAMETERS<SERVICE>,
  ) => Promise<ENTITY_STATE<PICK_ENTITY>[]>;
  checkConfig: () => Promise<CheckConfigResult>;
  fetch: TFetch;
  fetchEntityCustomizations: <
    T extends Record<never, unknown> = Record<
      "global" | "local",
      Record<string, string>
    >,
  >(
    entityId: string | string[],
  ) => Promise<T>;
  fetchEntityHistory: <
    ENTITY extends PICK_ENTITY = PICK_ENTITY,
    T extends ENTITY_STATE<ENTITY> = ENTITY_STATE<ENTITY>,
  >(
    entity_id: ENTITY,
    from: Date,
    to: Date,
    extra?: {
      minimal_response?: "";
    },
  ) => Promise<T[]>;
  fireEvent: <DATA extends object = object>(
    event: string,
    data?: DATA,
  ) => Promise<void>;
  getAllEntities: () => Promise<GenericEntityDTO[]>;
  getConfig: () => Promise<HassConfig>;
  getLogs: () => Promise<HomeAssistantServerLogItem[]>;
  getRawLogs: () => Promise<string>;
  listServices: () => Promise<HassServiceDTO[]>;
  updateEntity: <
    STATE extends string | number = string,
    ATTRIBUTES extends object = object,
  >(
    entity_id: PICK_ENTITY,
    { attributes, state }: SendBody<STATE, ATTRIBUTES>,
  ) => Promise<void>;
  webhook: (name: string, data?: object) => Promise<void>;
};
