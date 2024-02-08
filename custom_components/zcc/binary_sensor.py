from .api import ZccApi
from .health_sensor import HealthCheckSensor, start_health_check_polling
from . import DOMAIN

async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Setup the ZCC binary sensor platform."""
    # Ensure API is already set up
    if DOMAIN not in hass.data:
        return False

    api = hass.data[DOMAIN]['api']

    # Fetch service data to create a meaningful sensor name
    service_data = await api.service_data()
    service_name = service_data['name']
    sensor_name = f"{service_name}_is_online"
    sensor = HealthCheckSensor(api, sensor_name)

    # Add the sensor entity
    async_add_entities([sensor], True)

    # Optionally, start the polling loop
    hass.loop.create_task(start_health_check_polling(api, sensor, hass))
