import paho.mqtt.client as mqtt
import json
import time
import random
import os
import requests
from datetime import datetime

# MQTT Configuration
MQTT_BROKER = os.getenv('MQTT_BROKER', 'mosquitto')
MQTT_PORT = int(os.getenv('MQTT_PORT', '1883'))
MQTT_TOPIC = 'smart_home/energy'
MQTT_CONTROL_TOPIC = 'smart_home/control/#'

# Backend API
BACKEND_URL = os.getenv('BACKEND_URL', 'http://backend:8000')

# Device state tracking
device_states = {
    "Refrigerator": {"status": "on", "min": 0.1, "max": 0.15},
    "AC": {"status": "on", "min": 0.8, "max": 1.5},
    "TV": {"status": "on", "min": 0.05, "max": 0.2},
    "Washing Machine": {"status": "on", "min": 0.3, "max": 0.5},
    "Lights": {"status": "on", "min": 0.01, "max": 0.06}
}

def sync_device_states_from_backend():
    """Sync device states from backend database on startup"""
    try:
        response = requests.get(f"{BACKEND_URL}/api/devices", timeout=5)
        if response.status_code == 200:
            devices = response.json()
            for device in devices:
                device_name = device['name']
                if device_name in device_states:
                    device_states[device_name]['status'] = device['status']
                    print(f"📥 Synced {device_name}: {device['status'].upper()}", flush=True)
            print("✅ Device states synced from backend", flush=True)
            return True
        else:
            print(f"⚠️  Backend returned status {response.status_code}", flush=True)
            return False
    except Exception as e:
        print(f"⚠️  Failed to sync with backend: {e}", flush=True)
        print("   Starting with default 'on' states", flush=True)
        return False

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✅ Connected to MQTT Broker at {MQTT_BROKER}:{MQTT_PORT}", flush=True)
        result, mid = client.subscribe(MQTT_CONTROL_TOPIC, qos=1)
        print(f"✅ Subscribed to {MQTT_CONTROL_TOPIC} with result: {result}, mid: {mid}, QoS: 1", flush=True)
    else:
        print(f"❌ Failed to connect, return code {rc}", flush=True)

def on_subscribe(client, userdata, mid, granted_qos):
    print(f"✅ Subscription confirmed! Mid: {mid}, Granted QoS: {granted_qos}", flush=True)

def on_message(client, userdata, msg):
    print(f"🔔 MQTT message received on topic: {msg.topic}", flush=True)
    print(f"   Payload: {msg.payload.decode()}", flush=True)
    try:
        payload = json.loads(msg.payload.decode())
        device_name = payload.get("device_name")
        command = payload.get("command")
        
        if device_name in device_states:
            device_states[device_name]["status"] = command
            print(f"✅ Control received: {device_name} -> {command.upper()}", flush=True)
        else:
            print(f"❌ Unknown device: {device_name}", flush=True)
    except Exception as e:
        print(f"❌ Error processing control message: {e}", flush=True)

def simulate_energy_data(client):
    while True:
        for device_name, device_info in device_states.items():
            if device_info["status"] == "on":
                consumption = round(random.uniform(device_info["min"], device_info["max"]), 3)
                
                data = {
                    "device_name": device_name,
                    "consumption": consumption,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                client.publish(MQTT_TOPIC, json.dumps(data))
                print(f"Published: {device_name} = {consumption} kW (ON)")
            else:
                print(f"Skipped: {device_name} (OFF)")
        
        time.sleep(10)

def main():
    print("Starting Smart Home Energy Simulator...")
    print(f"MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")
    print(f"Backend API: {BACKEND_URL}")
    
    # Sync device states from backend first
    print("🔄 Syncing device states from backend...")
    sync_device_states_from_backend()
    
    # Use CallbackAPIVersion to avoid deprecation warning  
    from paho.mqtt.client import CallbackAPIVersion
    client = mqtt.Client(
        CallbackAPIVersion.VERSION1,
        client_id="smart_home_simulator",
        clean_session=True
    )
    client.on_connect = on_connect
    client.on_subscribe = on_subscribe
    client.on_message = on_message
    
    connected = False
    retry_count = 0
    max_retries = 10
    
    while not connected and retry_count < max_retries:
        try:
            client.connect(MQTT_BROKER, MQTT_PORT, 60)
            client.loop_start()  # Start loop immediately after connect
            connected = True
            time.sleep(2)  # Give time for on_connect callback to fire and subscribe
            print("🚀 Simulator ready, starting energy data publishing...", flush=True)
        except Exception as e:
            retry_count += 1
            print(f"Connection attempt {retry_count}/{max_retries} failed: {e}")
            time.sleep(5)
    
    if not connected:
        print("Failed to connect to MQTT broker after maximum retries")
        return
    
    try:
        simulate_energy_data(client)
    except KeyboardInterrupt:
        print("\nShutting down simulator...")
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()