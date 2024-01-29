import requests

class HTTPApiHandler:
    def __init__(self, base_url, admin_key):
        self.base_url = base_url
        self.headers = {'x-admin-key': admin_key}

    async def get_configuration(self):
        return await requests.post(f"{self.base_url}/hass/configure", headers=self.headers)

    async def health_check(self):
        return await requests.get(f"{self.base_url}/hass/health", headers=self.headers)
