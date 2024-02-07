import voluptuous as vol
from homeassistant import config_entries
from .const import CONF_BASE_URL, CONF_ADMIN_KEY

class ZCCConfigFlow(config_entries.ConfigFlow, domain="zcc"):
    async def async_step_user(self, user_input=None):
        if user_input is not None:
            # TODO: Handle user input and validation
            return self.async_create_entry(title="ZCC Virtual Entities", data=user_input)

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required(CONF_BASE_URL): str,
                vol.Required(CONF_ADMIN_KEY): str
            })
        )
