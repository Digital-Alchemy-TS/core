from homeassistant.components.button import ButtonEntity
from .const import DOMAIN
import logging

_LOGGER = logging.getLogger(__name__)


class ZccButton(ButtonEntity):
    def __init__(self, api, button_info):
        self._api = api
        self._id = button_info['id']
        self._name = button_info['name']
        self._icon = button_info['icon']

    @property
    def unique_id(self):
        """Return a unique ID."""
        return self._id

    @property
    def name(self):
        return self._name

    @property
    def icon(self):
        return self._icon

    @property
    def available(self):
        """Return if the button is available."""
        # Check the global health status
        return self.hass.data[DOMAIN].get('health_status', False)

    async def async_press(self):
        """Handle the button press."""
        try:
            await self._api.press_button(self._id)
        except Exception as e:
            _LOGGER.error(f"Error pressing button {self._name} (ID: {self._id}): {e}")

    async def async_added_to_hass(self):
        """When entity is added to Home Assistant."""
        self.async_on_remove(
            self.hass.bus.async_listen('zcc_health_status_updated', self._handle_health_update)
        )

    async def _handle_health_update(self, event):
        """Handle health status update."""
        # Update the entity's available state based on the event data
        # Trigger an update of the entity's state if necessary
        self.async_schedule_update_ha_state(True)


async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Setup button platform."""
    api = hass.data[DOMAIN]['api']
    buttons_data = await api.list_buttons()
    if buttons_data is None:
        return
    buttons = [ZccButton(api, button) for button in buttons_data['buttons']]
    async_add_entities(buttons)
