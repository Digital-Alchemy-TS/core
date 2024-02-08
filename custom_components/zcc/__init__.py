from homeassistant.components.webhook import async_register as async_register_webhook
from homeassistant.core import HomeAssistant
import homeassistant.helpers.config_validation as cv
import voluptuous as vol



from .api import ZccApi
from .const import CONF_BASE_URL, CONF_ADMIN_KEY, DOMAIN
from .webhook import handle_webhook

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
    hass.data[DOMAIN]['service_data'] = await api.application_data()

    hass.async_create_task(
        hass.helpers.discovery.async_load_platform('binary_sensor', DOMAIN, None, config)
    )

    hass.async_create_task(
        hass.helpers.discovery.async_load_platform('button', DOMAIN, None, config)
    )

    hass.async_create_task(
        hass.helpers.discovery.async_load_platform('switch', DOMAIN, None, config)
    )

    hass.async_create_task(
        hass.helpers.discovery.async_load_platform('scene', DOMAIN, None, config)
    )


    hass.data[DOMAIN]['webhook_id'] = webhook_id
    hass.components.webhook.async_register(DOMAIN, "ZCC Binary Sensor Webhook", webhook_id, handle_webhook)

    return True
