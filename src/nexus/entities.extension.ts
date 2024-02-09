import { TServiceParams } from "..";

export function EntitiesExtension({
  synapse,
  logger,
  context,
  scheduler,
}: TServiceParams) {
  synapse.button({
    context,
    exec: () => {
      logger.info("bananas clicked");
    },
    icon: "solar-angle",
    name: "Click for bananas",
  });
  synapse.button({
    context,
    exec: () => {
      logger.info("apples clicked");
    },
    icon: "sun-angle",
    name: "Click for apples",
  });
  synapse.button({
    context,
    exec: () => {
      logger.info("oranges clicked");
    },
    icon: "solar-angle",
    name: "Click for oranges",
  });
  const binary = synapse.binary_sensor({
    context,
    defaultState: "on",
    icon: "sun-angle",
    name: "Test binary sensor",
  });
  scheduler.interval({
    context,
    exec: () => {
      binary.on = !binary.on;
    },
    interval: 2000,
  });
}
