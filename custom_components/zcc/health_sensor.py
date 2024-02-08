import asyncio
from . import DOMAIN
from homeassistant.components.binary_sensor import BinarySensorEntity

class HealthCheckSensor(BinarySensorEntity):
    """Representation of a Health Check Binary Sensor."""

    def __init__(self, api, name):
        """Initialize the binary sensor."""
        self._api = api
        self._state = False
        self._last_state = False
        self._name = name

    @property
    def name(self):
        """Return the name of the binary sensor."""
        return self._name

    @property
    def is_on(self):
        """Return true if the binary sensor is on."""
        return self._state

    async def async_update(self):
        """Update the state of the sensor."""
        try:
            # Perform the health check
            health_status = await self._api.health_check()
            # Check if the state has changed since the last update
            if health_status != self._last_state:
                # Update the global health status
                self.hass.data[DOMAIN]['health_status'] = health_status
                # Fire a custom event
                self.hass.bus.async_fire('zcc_health_status_updated', {'status': health_status})
                # Update the last known state
                self._last_state = health_status
            # Set the current state
            self._state = health_status
        except Exception as e:
            self._state = False
            if self._last_state != self._state:
                # Update the global health status in case of an error too
                self.hass.data[DOMAIN]['health_status'] = False
                # Fire the custom event if the status changed due to the error
                self.hass.bus.async_fire('zcc_health_status_updated', {'status': False})
                self._last_state = False

    async def async_added_to_hass(self):
        """Run when this Entity has been added to Home Assistant."""
        self.async_schedule_update_ha_state(True)

async def start_health_check_polling(api, sensor, hass):
    """Start polling the health check endpoint."""
    while True:
        await sensor.async_update()
        await asyncio.sleep(2)  # Adjust polling interval as needed
