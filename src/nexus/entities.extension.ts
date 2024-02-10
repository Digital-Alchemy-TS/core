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
  const sensor = synapse.sensor({
    context,
    defaultAttributes: {
      number: 5000,
    },
    defaultState: "banana",
    name: "Demo sensor",
  });
  scheduler.interval({
    context,
    exec: () => {
      binary.on = !binary.on;
    },
    interval: 2000,
  });
  synapse.scene({
    context,
    exec: () => {
      logger.warn("scene activated");
    },
    name: "test scene",
  });
}
