from homeassistant.components.sensor import SensorEntity

def setup_platform(hass, config, add_entities, discovery_info=None):
    """Set up the sensor platform."""
    add_entities([ZCCSensor()])

class ZCCSensor(SensorEntity):
    """Representation of a Sensor."""

    @property
    def name(self):
        """Return the name of the sensor."""
        return 'ZCC Example Sensor'

    @property
    def state(self):
        """Return the state of the sensor."""
        return 'Hello World'
