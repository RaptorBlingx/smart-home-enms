-- Create tables
CREATE TABLE IF NOT EXISTS energy_consumption (
    id SERIAL PRIMARY KEY,
    device_name VARCHAR(255) NOT NULL,
    consumption FLOAT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'on',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_energy_device_name ON energy_consumption(device_name);
CREATE INDEX IF NOT EXISTS idx_energy_timestamp ON energy_consumption(timestamp);
CREATE INDEX IF NOT EXISTS idx_devices_name ON devices(name);

-- Insert sample devices
INSERT INTO devices (name, type, status) VALUES
('Refrigerator', 'Appliance', 'on'),
('AC', 'Appliance', 'on'),
('TV', 'Entertainment', 'on'),
('Washing Machine', 'Appliance', 'on'),
('Lights', 'Light', 'on')
ON CONFLICT (name) DO NOTHING;

-- Insert historical mock data (past 7 days)
INSERT INTO energy_consumption (device_name, consumption, timestamp)
SELECT 
    device_name,
    (random() * (max_consumption - min_consumption) + min_consumption)::numeric(10,3),
    timestamp
FROM (
    VALUES 
        ('Living Room Light', 0.01, 0.06),
        ('Kitchen Refrigerator', 0.1, 0.15),
        ('Bedroom AC', 0.8, 1.5),
        ('Washing Machine', 0.3, 0.5),
        ('TV', 0.05, 0.2)
) AS devices(device_name, min_consumption, max_consumption)
CROSS JOIN generate_series(
    NOW() - INTERVAL '7 days',
    NOW(),
    INTERVAL '1 hour'
) AS timestamp
ON CONFLICT DO NOTHING;