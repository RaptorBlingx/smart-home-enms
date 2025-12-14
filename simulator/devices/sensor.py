class Sensor:
    def __init__(self, sensor_id, sensor_type):
        self.sensor_id = sensor_id
        self.sensor_type = sensor_type
        self.data = None

    def collect_data(self):
        # Simulate data collection
        self.data = self.simulate_data()
        return self.data

    def simulate_data(self):
        # Placeholder for data simulation logic
        import random
        return random.uniform(0, 100)  # Simulating a value between 0 and 100

    def get_data(self):
        return self.data

    def __str__(self):
        return f"Sensor ID: {self.sensor_id}, Type: {self.sensor_type}, Data: {self.data}"