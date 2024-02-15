from homeassistant.core import callback
from homeassistant.components.binary_sensor import BinarySensorEntity
from .const import DOMAIN
import logging

_LOGGER = logging.getLogger(__name__)


class HealthCheckSensor(BinarySensorEntity):
    """Representation of a Health Check Binary Sensor."""

    def __init__(self, hass, app):
        """Initialize the binary sensor."""
        self.hass = hass

        if "health_status" not in hass.data[DOMAIN]:
            hass.data[DOMAIN]["health_status"] = {}

        self._app = app
        self.hass.data[DOMAIN]["health_status"][app] = False
        _LOGGER.info(f"creating health check sensor for {app}")

        self._name = f"{app} online"
        self._id = f"{app}_is_online"
        self._heartbeat_timer = None

    @property
    def name(self):
        """Return the name of the binary sensor."""
        return self._name

    @property
    def unique_id(self):
        """Return a unique identifier for this button."""
        return self._id

    @property
    def is_on(self):
        """Return true if the binary sensor is on (indicating 'alive')."""
        return self.hass.data[DOMAIN]["health_status"][self._app]

    async def async_added_to_hass(self):
        """Run when this Entity has been added to Home Assistant."""
        self.hass.bus.async_listen(f"zcc_heartbeat_{self._app}", self.handle_heartbeat)
        self.reset_heartbeat_timer()

    @callback
    def handle_heartbeat(self, event):
        """Handle heartbeat events."""
        self.reset_heartbeat_timer()

        # ? Don't announce anything if the state didn't change
        if self.hass.data[DOMAIN]["health_status"][self._app] == True:
            return

        # ? Update flags, and send an update event
        self.hass.data[DOMAIN]["health_status"][self._app] = True
        self.async_write_ha_state()
        self.hass.bus.async_fire(f"zcc_health_{self._app}")

    def reset_heartbeat_timer(self):
        """Reset the heartbeat timer to detect unavailability."""
        if self._heartbeat_timer:
            self._heartbeat_timer.cancel()

        self._heartbeat_timer = self.hass.loop.call_later(30, self.mark_as_dead)

    def mark_as_dead(self):
        """Actions to take when the application is considered dead."""
        if self.hass.data[DOMAIN]["health_status"][self._app] == False:
            # ? I'm pretty sure this condition shouldn't happen
            return

        _LOGGER.info(f"failed to receive health check for {self._app}")
        self.hass.data[DOMAIN]["health_status"][self._app] = False
        self.async_write_ha_state()
        self.hass.bus.async_fire(f"zcc_health_{self._app}")

    async def async_will_remove_from_hass(self):
        """Cleanup the timer when entity is removed."""
        _LOGGER.info(f"removing health check for {self._app}")
        if self._heartbeat_timer:
            self._heartbeat_timer.cancel()
        self.hass.data[DOMAIN]["health_status"].pop(self._app)
