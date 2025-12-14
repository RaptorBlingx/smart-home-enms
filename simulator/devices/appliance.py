class Appliance:
    def __init__(self, name, power_rating):
        self.name = name
        self.power_rating = power_rating  # in watts
        self.is_on = False

    def turn_on(self):
        self.is_on = True

    def turn_off(self):
        self.is_on = False

    def get_power_consumption(self, hours):
        if self.is_on:
            return self.power_rating * hours  # in watt-hours
        return 0

class SmartAppliance(Appliance):
    def __init__(self, name, power_rating, device_id):
        super().__init__(name, power_rating)
        self.device_id = device_id

    def send_status(self):
        # Placeholder for sending status to a server or MQTT broker
        status = {
            "device_id": self.device_id,
            "name": self.name,
            "is_on": self.is_on,
            "power_rating": self.power_rating
        }
        return status