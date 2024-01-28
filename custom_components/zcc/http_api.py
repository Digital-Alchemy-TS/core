import requests

class HTTPApiHandler:
    def __init__(self, base_url, admin_key):
        self.base_url = base_url
        self.headers = {'x-admin-key': admin_key}

    def post_configure(self):
        # Implement the POST /hass/configure logic
        response = requests.post(f"{self.base_url}/hass/configure", headers=self.headers)
        # Handle response

    def get_health(self):
        # Implement the GET /hass/health logic
        response = requests.get(f"{self.base_url}/hass/health", headers=self.headers)
        # Handle response
