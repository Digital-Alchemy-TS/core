import { InternalError, TServiceParams } from "../../boilerplate";
import { PICK_ENTITY } from "../../hass";
import { is, TContext } from "../../utilities";
import { MaterialIcon, MaterialIconTags, SensorDeviceClasses } from "..";

type TSensor<
  STATE extends SensorValue,
  ATTRIBUTES extends object = object,
  TAG extends MaterialIconTags = MaterialIconTags,
> = {
  context: TContext;
  defaultState?: STATE;
  icon?: MaterialIcon<TAG>;
  defaultAttributes?: ATTRIBUTES;
  id: string;
  name?: string;
} & SensorDeviceClasses;

type SensorValue = string | number;

export type VirtualSensor<
  STATE extends SensorValue = SensorValue,
  ATTRIBUTES extends object = object,
  TAG extends MaterialIconTags = MaterialIconTags,
> = {
  entity_id: PICK_ENTITY<"sensor">;
  icon: MaterialIcon<TAG>;
  attributes: Readonly<ATTRIBUTES>;
  name: string;
  state: STATE;
} & SensorDeviceClasses;

const CACHE_KEY = (key: string) => `sensor_state_cache:${key}`;

export function Sensor({
  logger,
  cache,
  context,
  lifecycle,
  server,
  synapse,
}: TServiceParams) {
  const registry = new Map<PICK_ENTITY<"sensor">, VirtualSensor>();
  lifecycle.onBootstrap(() => BindHTTP());

  function BindHTTP() {
    const fastify = server.bindings.httpServer;

    // # Describe the current situation
    fastify.get(`/synapse/sensor`, synapse.http.validation, () => ({
      switches: [...registry.values()].map(entity => {
        return {
          attributes: entity.attributes,
          icon: entity.icon,
          name: entity.name,
          state: entity.state,
        };
      }),
    }));
  }

  // # Sensor creation function
  function create<
    STATE extends SensorValue = SensorValue,
    ATTRIBUTES extends object = object,
    TAG extends MaterialIconTags = MaterialIconTags,
  >(entity: TSensor<STATE, ATTRIBUTES, TAG>) {
    // ## Validate a good id was passed, and it's the only place in code that's using it
    if (!is.domain(entity.id, "sensor")) {
      throw new InternalError(
        context,
        "INVALID_ID",
        "sensor domain entity_id is required",
      );
    }
    if (registry.has(entity.id)) {
      throw new InternalError(
        context,
        "DUPLICATE_SENSOR",
        "sensor id is already in use",
      );
    }
    logger.debug({ entity }, `create sensor`);

    let state: STATE;
    let attributes: ATTRIBUTES;

    async function setState(newState: STATE) {
      logger.trace({ id: entity.id, newState }, `update sensor state`);
      state = newState;
      await cache.set(CACHE_KEY(entity.id), state);
    }

    async function setAttributes(newAttributes: ATTRIBUTES) {
      logger.trace(
        { id: entity.id, newAttributes },
        `update sensor attributes (all)`,
      );
      attributes = newAttributes;
      await cache.set(CACHE_KEY(entity.id), state);
    }

    async function setAttribute<
      KEY extends keyof ATTRIBUTES,
      VALUE extends ATTRIBUTES[KEY],
    >(key: KEY, value: VALUE) {
      logger.trace(
        { id: entity.id, key, value },
        `update sensor attributes (single)`,
      );
      attributes[key] = value;
      setImmediate(async () => {
        await cache.set(CACHE_KEY(entity.id), state);
      });
    }

    // ## Wait until bootstrap to load cache
    lifecycle.onBootstrap(async () => {
      const data = await cache.get(CACHE_KEY(entity.id), {
        attributes: entity.defaultAttributes,
        state: entity.defaultState,
      });
      state = data.state;
      attributes = data.attributes;
    });

    // ## Proxy object as return
    const sensorOut = new Proxy({} as VirtualSensor<STATE>, {
      // ### Getters
      get(_, property: keyof VirtualSensor<STATE>) {
        if (property === "entity_id") {
          return entity.id;
        }
        if (property === "state") {
          return state;
        }
        if (property === "attributes") {
          return new Proxy({} as ATTRIBUTES, {
            get: <KEY extends Extract<keyof ATTRIBUTES, string>>(
              _: ATTRIBUTES,
              property: KEY,
            ) => {
              return attributes[property];
            },
            set: <
              KEY extends Extract<keyof ATTRIBUTES, string>,
              VALUE extends ATTRIBUTES[KEY],
            >(
              _: ATTRIBUTES,
              property: KEY,
              value: VALUE,
            ) => {
              setAttribute(property, value);
              return true;
            },
          });
        }
        if (property === "icon") {
          return entity.icon;
        }
        return undefined;
      },
      // ### Setters
      set(_, property: string, value: unknown) {
        if (property === "state") {
          setState(value as STATE);
          return true;
        }
        if (property === "attributes") {
          setAttributes(value as ATTRIBUTES);
          return true;
        }
        return false;
      },
    });

    // ## Register it
    registry.set(entity.id, sensorOut);
    return sensorOut;
  }

  return create;
}
