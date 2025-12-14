import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;

const EnergyMonitor = () => {
    const [energyData, setEnergyData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchEnergyData = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/api/energy/consumption`);
                setEnergyData(response.data);
                setLoading(false);
                setError(null);
            } catch (error) {
                console.error('Error fetching energy data:', error);
                setError('Failed to load energy data');
                setLoading(false);
            }
        };

        fetchEnergyData();
        const interval = setInterval(fetchEnergyData, 10000); // Fetch data every 10 seconds

        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="energy-monitor"><p>Loading energy data...</p></div>;
    if (error) return <div className="energy-monitor"><p className="error">{error}</p></div>;

    return (
        <div className="energy-monitor">
            <h2>Real-Time Energy Monitor</h2>
            <div className="consumption-list">
                <table>
                    <thead>
                        <tr>
                            <th>Device</th>
                            <th>Consumption (kWh)</th>
                            <th>Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        {energyData.slice(0, 50).map((data, index) => (
                            <tr key={index}>
                                <td>{data.device_name}</td>
                                <td>{parseFloat(data.consumption).toFixed(3)}</td>
                                <td>{new Date(data.timestamp).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default EnergyMonitor;