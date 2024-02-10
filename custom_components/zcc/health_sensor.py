from homeassistant.core import callback
from homeassistant.components.binary_sensor import BinarySensorEntity
from .const import DOMAIN  # Ensure DOMAIN is correctly defined in your const.py
import logging

_LOGGER = logging.getLogger(__name__)

class HealthCheckSensor(BinarySensorEntity):
    """Representation of a Health Check Binary Sensor."""

    def __init__(self, hass):
        """Initialize the binary sensor."""
        self.hass = hass
        hass.data[DOMAIN]['health_status'] = False
        self._name = "Synapse is connected"
        self._heartbeat_timer = None

    @property
    def name(self):
        """Return the name of the binary sensor."""
        return self._name

    @property
    def is_on(self):
        """Return true if the binary sensor is on (indicating 'alive')."""
        return self.hass.data[DOMAIN]['health_status']

    async def async_added_to_hass(self):
        """Run when this Entity has been added to Home Assistant."""
        self.hass.bus.async_listen('zcc_heartbeat', self.handle_heartbeat)
        self.reset_heartbeat_timer()

    @callback
    def handle_heartbeat(self, event):
        """Handle heartbeat events."""

        self.async_write_ha_state()
        self.reset_heartbeat_timer()

        self.hass.bus.async_fire('zcc_health_status_updated', {
            'status': True
        })

        self.hass.data[DOMAIN]['health_status'] = True
        self.async_write_ha_state()

    def reset_heartbeat_timer(self):
        """Reset the heartbeat timer to detect unavailability."""
        if self._heartbeat_timer:
            self._heartbeat_timer.cancel()

        self._heartbeat_timer = self.hass.loop.call_later(30, self.mark_as_dead)

    def mark_as_dead(self):
        """Actions to take when the application is considered dead."""

        self.hass.data[DOMAIN]['health_status'] = False
        self.async_write_ha_state()

        self.hass.bus.async_fire('zcc_health_status_updated', {
            'status': False
        })


    async def async_will_remove_from_hass(self):
        """Cleanup the timer when entity is removed."""
        if self._heartbeat_timer:
            self._heartbeat_timer.cancel()
