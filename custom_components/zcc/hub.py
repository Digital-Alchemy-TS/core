from __future__ import annotations

# In a real implementation, this would be in an external library that's on PyPI.
# The PyPI package needs to be included in the `requirements` section of manifest.json
# See https://developers.home-assistant.io/docs/creating_integration_manifest
# for more information.
# This dummy hub always returns 3 rollers.
import asyncio
import random

from homeassistant.core import HomeAssistant
from requests import RequestException
from .zcc_api import HTTPApiHandler


class Hub:
    manufacturer = "ZCC"

    def __init__(self, hass: HomeAssistant, base_url: str, admin_key: str) -> None:
        """Init dummy hub."""
        self._base_url = base_url
        self._hass = hass
        self._name = base_url
        self._key = admin_key;
        self._id = base_url.lower()
        # self.rollers = [
        #     Roller(f"{self._id}_1", f"{self._name} 1", self),
        #     Roller(f"{self._id}_2", f"{self._name} 2", self),
        #     Roller(f"{self._id}_3", f"{self._name} 3", self),
        # ]
        self.api = HTTPApiHandler(base_url, admin_key)
        # test = api_handler.
        self.online = True

    @property
    def hub_id(self) -> str:
        """ID for dummy hub."""
        return self._id

    async def test_connection(self) -> bool:
        """Test connectivity to the app is OK."""
        try:
            await self.api.health_check()
            return True
        except RequestException:
            return False
