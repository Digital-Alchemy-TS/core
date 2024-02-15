from homeassistant.core import HomeAssistant
from homeassistant.helpers.discovery import async_load_platform

from .const import DOMAIN
import logging



async def async_setup(hass: HomeAssistant, config):
    """Set up the ZCC component."""
    if DOMAIN not in hass.data:
        hass.data[DOMAIN] = {}

    if "health_status" not in hass.data[DOMAIN]:
      hass.data[DOMAIN]["health_status"] = {}

    if DOMAIN not in hass.data:
        hass.data[DOMAIN] = {}

    if "health_status" not in hass.data[DOMAIN]:
      hass.data[DOMAIN]["health_status"] = {}


    hass.async_create_task(
        async_load_platform(hass, "binary_sensor", DOMAIN, {}, config)
    )

    hass.async_create_task(
        async_load_platform(hass, "button", DOMAIN, {}, config)
    )

    hass.async_create_task(
        async_load_platform(hass, "switch", DOMAIN, {}, config)
    )

    hass.async_create_task(
        async_load_platform(hass, "scene", DOMAIN, {}, config)
    )

    hass.async_create_task(
        async_load_platform(hass, "sensor", DOMAIN, {}, config)
    )

    hass.bus.async_fire("zcc_app_reload_all")

    return True
