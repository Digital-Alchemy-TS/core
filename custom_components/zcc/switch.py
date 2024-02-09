from homeassistant.components.switch import SwitchEntity
from .const import DOMAIN
import logging

_LOGGER = logging.getLogger(__name__)

class ZccSwitch(SwitchEntity):
    def __init__(self, hass, api, switch):
        self.hass = hass
        self._api = api
        self._id = switch['id']
        self._name = switch['name']
        self._icon = switch['icon']
        self._state = switch['state'] == "on"

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
    def is_on(self):
        return self._state

    async def async_turn_on(self):
        """Turn the switch on."""
        if self._state == True:
          return
        success = await self._api.update_switch(self._name, "on")
        if success:
            self._state = True
            self.async_write_ha_state()

    async def async_turn_off(self):
        """Turn the switch off."""
        if self._state == False:
          return
        success = await self._api.update_switch(self._name, "off")
        if success:
            self._state = False
            self.async_write_ha_state()

async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Set up the ZCC switch platform."""
    api = hass.data[DOMAIN]['api']
    switches_data = await api.list_switches()
    if switches_data is None:
        return
    switches = [ZccSwitch(hass, api, switch) for switch in switches_data['switches']]
    async_add_entities(switches)

    # Store references for access by the webhook
    if 'switch_entities' not in hass.data[DOMAIN]:
        hass.data[DOMAIN]['switch_entities'] = {}
    for switch in switches:
        hass.data[DOMAIN]['switch_entities'][switch.unique_id] = switch
