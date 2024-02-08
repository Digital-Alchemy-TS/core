import aiohttp
from aiohttp import ClientTimeout
import logging
from typing import TypedDict

_LOGGER = logging.getLogger(__name__)

class ApplicationDataResponse(TypedDict):
    application: str
    webhook_id: str

class HealthCheckResponse(TypedDict):
    alive: bool

class ZCCButton(TypedDict):
    id: str
    name: str
    icon: str

class ZccApi:
    def __init__(self, hass, base_url, admin_key):
        self.hass = hass
        self.base_url = base_url
        self.headers = {'x-admin-key': admin_key}
        self.session = aiohttp.ClientSession()
        self.timeout = ClientTimeout(total=1)  # 1 second total timeout


    async def health_check(self) -> HealthCheckResponse:
        """Perform a health check by querying the health endpoint."""
        url = f"{self.base_url}/synapse/health"
        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            async with session.get(url, headers=self.headers) as response:
                return response.status == 200

    async def application_data(self) -> ApplicationDataResponse:
        url = f"{self.base_url}/synapse/application-data"
        async with self.session.get(url, headers=self.headers) as response:
            if response.status == 200:
                return await response.json()
            else:
                return None

    async def list_buttons(self):
        url = f"{self.base_url}/synapse/list-buttons"
        async with self.session.get(url, headers=self.headers) as response:
            if response.status == 200:
                return await response.json()
            else:
                return None

    async def list_sensors(self):
        url = f"{self.base_url}/synapse/list-sensors"
        async with self.session.get(url, headers=self.headers) as response:
            if response.status == 200:
                return await response.json()
            else:
                return None

    async def list_binary_sensors(self):
        url = f"{self.base_url}/synapse/list-binary-sensors"
        async with self.session.get(url, headers=self.headers) as response:
            if response.status == 200:
                return await response.json()
            else:
                return None

    async def list_switches(self):
        url = f"{self.base_url}/synapse/list-switches"
        async with self.session.get(url, headers=self.headers) as response:
            if response.status == 200:
                return await response.json()
            else:
                return None

    async def update_switch(self, switch_id, state):
        url = f"{self.base_url}/synapse/update-switch/{switch_id}/{state}"
        try:
            async with self.session.post(url, json={}, headers=self.headers) as response:
                return response.status == 200
        except Exception as e:
            _LOGGER.error(f"Exception when pressing button {switch_id}: {e}")
            return False

    async def press_button(self, button_id):
        url = f"{self.base_url}/synapse/button-press/{button_id}"
        try:
            async with self.session.post(url, json={}, headers=self.headers) as response:
                return response.status == 200
        except Exception as e:
            _LOGGER.error(f"Exception when pressing button {button_id}: {e}")
            return False

    async def close(self):
        await self.session.close()
