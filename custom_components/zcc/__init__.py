from homeassistant.core import HomeAssistant

from .const import DOMAIN
import logging

_LOGGER = logging.getLogger(__name__)


async def async_setup(hass: HomeAssistant, config):
    """Set up the ZCC component."""

    # Initialize the API and store it for shared access
    if DOMAIN not in hass.data:
        hass.data[DOMAIN] = {}
    hass.data[DOMAIN]["health_status"] = True

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

    hass.bus.async_fire('zcc_extension_loaded')
    _LOGGER.info("extension loaded")

    return True
