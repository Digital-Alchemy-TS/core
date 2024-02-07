from homeassistant.helpers.entity import Entity

class ZCCEntity(Entity):
    def __init__(self, entity_id, name, icon):
        self.entity_id = entity_id
        self._name = name
        self._icon = icon

    @property
    def name(self):
        return self._name

    @property
    def icon(self):
        return self._icon

    # Implement other necessary methods and properties
