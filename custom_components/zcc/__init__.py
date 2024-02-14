from homeassistant.core import HomeAssistant

from .const import DOMAIN
import logging

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config):
    """Set up the ZCC component."""

    # Initialize the API and store it for shared access
    if DOMAIN not in hass.data:
        hass.data[DOMAIN] = {}
    hass.data[DOMAIN]["health_status"] = {}

    hass.async_create_task(
        hass.helpers.discovery.async_load_platform(
            "binary_sensor", DOMAIN, None, config
        )
    )

    hass.async_create_task(
        hass.helpers.discovery.async_load_platform("button", DOMAIN, None, config)
    )

    hass.async_create_task(
        hass.helpers.discovery.async_load_platform("switch", DOMAIN, None, config)
    )

    hass.async_create_task(
        hass.helpers.discovery.async_load_platform("sensor", DOMAIN, None, config)
    )

    hass.async_create_task(
        hass.helpers.discovery.async_load_platform("scene", DOMAIN, None, config)
    )

    _LOGGER.info("extension loaded")


    async def handle_reload_service(call):
        """Handle the 'reload' service call."""
        app_name = call.data.get('app', None)
        if app_name == None:
            hass.bus.async_fire('zcc_app_reload_all')
            return
        hass.bus.async_fire('zcc_app_reload', {'app': app_name})

    hass.services.async_register(DOMAIN, 'reload', handle_reload_service)
    hass.bus.async_fire('zcc_app_reload_all')

    return True
