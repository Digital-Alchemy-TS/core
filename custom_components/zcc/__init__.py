import asyncio
from homeassistant.core import HomeAssistant, ConfigEntry
from .const import CONF_BASE_URL, CONF_ADMIN_KEY, DOMAIN
from .zcc_api import HTTPApiHandler

async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry
) -> bool:
    """Set up platform from a ConfigEntry."""
    # Initialize HTTP API handler
    base_url = entry.data[CONF_BASE_URL]
    admin_key = entry.data[CONF_ADMIN_KEY]
    api_handler = HTTPApiHandler(base_url, admin_key)

    # Store in hass data for use in other components
    hass.data[DOMAIN] = {
        "api_handler": api_handler
    }

    # Setup other platform initialization here (if any)
    # e.g., await hass.async_create_task(...)
    return True
