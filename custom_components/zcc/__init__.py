from homeassistant.core import HomeAssistant
import voluptuous as vol
import homeassistant.helpers.config_validation as cv
from .api import ZccApi
from .const import CONF_BASE_URL, CONF_ADMIN_KEY

DOMAIN = 'zcc'

CONFIG_SCHEMA = vol.Schema({
    DOMAIN: vol.Schema({
        vol.Required(CONF_BASE_URL): cv.url,
        vol.Required(CONF_ADMIN_KEY): cv.string,
    })
}, extra=vol.ALLOW_EXTRA)

async def async_setup(hass: HomeAssistant, config):
    """Set up the ZCC component."""
    conf = config[DOMAIN]
    base_url = conf[CONF_BASE_URL]
    admin_key = conf[CONF_ADMIN_KEY]

    # Initialize the API and store it for shared access
    api = ZccApi(hass, base_url, admin_key)
    if DOMAIN not in hass.data:
        hass.data[DOMAIN] = {}
    hass.data[DOMAIN]['api'] = api
    hass.data[DOMAIN]['health_status'] = True
    hass.data[DOMAIN]['admin_key'] = admin_key

    # Load the binary_sensor platform
    hass.helpers.discovery.load_platform('binary_sensor', DOMAIN, None, config)

    # Load the button platform
    hass.async_create_task(
        hass.helpers.discovery.async_load_platform('button', DOMAIN, None, config)
    )

    # Inside your async_setup function, after setting up the API
    hass.async_create_task(
        hass.helpers.discovery.async_load_platform('switch', DOMAIN, None, config)
    )

    return True
