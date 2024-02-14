from .health_sensor import HealthCheckSensor
from .const import DOMAIN
from homeassistant.core import callback
from homeassistant.components.binary_sensor import BinarySensorEntity
import logging

_LOGGER = logging.getLogger(__name__)


async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Setup the ZCC binary sensor platform."""
    if DOMAIN not in hass.data:
        return False

    if "health_sensor" not in hass.data[DOMAIN]:
        hass.data[DOMAIN]["health_sensor"] = {}
    if "binary_sensor" not in hass.data[DOMAIN]:
        hass.data[DOMAIN]["binary_sensor"] = {}

    @callback
    def handle_application_upgrade(event):
        """Handle incoming binary sensor update."""
        app = event.data.get('app')

        # * First time seeing this app, create health check sensor
        if app not in hass.data[DOMAIN]["health_sensor"]:
            _LOGGER.info(f"creating health check sensor for {app}")
            sensor = HealthCheckSensor(hass, app)
            hass.data[DOMAIN]["health_sensor"][app] = sensor
            async_add_entities([sensor], True)

        # * Process entities
        entities = event.data.get('domains', {}).get("binary_sensor", {})
        _LOGGER.info(f"{app} sent {len(entities)} entities")
        existing_entities = hass.data[DOMAIN]["binary_sensor"]

        for sensor in entities:
            id = sensor.get("id")
            if id in existing_entities:
                # * Update existing entity
                entity = existing_entities[id]
                entity._state = sensor.get("state", "off") == "on"
                entity.async_write_ha_state()
                _LOGGER.debug(f"{app} updating {sensor['name']}")

            else:
                # * Create new entity
                entity = ZccBinarySensor(hass, app, sensor)
                existing_entities[id] = entity
                async_add_entities([entity])
                _LOGGER.debug(f"{app} adding {sensor['name']}")

        # * Remove entities not in the update
        current_ids = set(existing_entities.keys())
        updated_ids = {sensor.get("id") for sensor in entities}
        for sensor_id in current_ids - updated_ids:
            entity = existing_entities.pop(sensor_id)
            _LOGGER.debug(f"{app} remove {entity._name}")
            hass.async_create_task(entity.async_remove())

    # * Attach update listener
    hass.bus.async_listen("zcc_application_state", handle_application_upgrade)
    return True


class ZccBinarySensor(BinarySensorEntity):
    def __init__(self, hass, app, sensor_info):
        self.hass = hass
        self._app = app
        self._id = sensor_info.get("id")
        self._name = sensor_info.get("name")
        self._icon = sensor_info.get("icon", "mdi:toggle-switch-variant-off")
        self._state = sensor_info.get("state", "off") == "on"

    @property
    def unique_id(self):
        """Return a unique ID."""
        return self._id

    @property
    def name(self):
        return self._name

    @property
    def icon(self):
        return self._icon

    @property
    def is_on(self):
        return self._state

    @property
    def extra_state_attributes(self):
        return {"Managed By": self._app}

    @property
    def available(self):
        return self.hass.data[DOMAIN]["health_status"].get(self._app, False)

    async def async_added_to_hass(self):
        """When entity is added to Home Assistant."""
        self.async_on_remove(
            self.hass.bus.async_listen(
                f"zcc_{self._app}_health_status_updated", self._handle_health_update
            )
        )

        self.async_on_remove(
            self.hass.bus.async_listen("zcc_event", self.handle_binary_sensor_event)
        )

    @callback
    async def _handle_health_update(self, event):
        """Handle health status update."""
        self.async_schedule_update_ha_state(True)

    async def handle_binary_sensor_event(self, event):
        """Handle incoming binary sensor update events."""
        # Check if the event is for this sensor
        if event.data.get("id") == self._id:
            new_state = event.data.get("data", {}).get("state")
            _LOGGER.debug(f"receiving update {self._name} => {new_state}")
            if new_state:
                self._state = True if new_state == "on" else False
                self.async_write_ha_state()
