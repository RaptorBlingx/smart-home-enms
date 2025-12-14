import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/Dashboard.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const Dashboard = () => {
    const [energyData, setEnergyData] = useState(null);
    const [devices, setDevices] = useState([]);
    const [recentData, setRecentData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(new Date());

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [energyResponse, devicesResponse, consumptionResponse] = await Promise.all([
                    axios.get(`${API_BASE_URL}/api/energy`),
                    axios.get(`${API_BASE_URL}/api/devices`),
                    axios.get(`${API_BASE_URL}/api/energy/consumption`)
                ]);
                
                setEnergyData(energyResponse.data);
                setDevices(devicesResponse.data);
                setRecentData(consumptionResponse.data.slice(0, 10));
                setLastUpdate(new Date());
                setLoading(false);
                setError(null);
            } catch (error) {
                console.error('Error fetching data:', error);
                setError(error.message || 'Failed to fetch data');
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    const getDeviceIcon = (type) => {
        const icons = {
            'Light': '💡',
            'Appliance': '🔌',
            'Entertainment': '📺',
            'HVAC': '❄️'
        };
        return icons[type] || '🏠';
    };

    const getTrendIndicator = () => {
        if (!energyData || !recentData.length) return null;
        const recent = recentData.slice(0, 5).reduce((sum, item) => sum + parseFloat(item.consumption), 0);
        const previous = recentData.slice(5, 10).reduce((sum, item) => sum + parseFloat(item.consumption), 0);
        const trend = recent > previous ? '📈' : '📉';
        const color = recent > previous ? '#e74c3c' : '#27ae60';
        return { trend, color };
    };

    if (loading) {
        return (
            <div className="dashboard">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Loading dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard">
                <div className="error-message">
                    <h2>⚠️ Connection Error</h2>
                    <p>{error}</p>
                    <p>Make sure the backend is running at {API_BASE_URL}</p>
                </div>
            </div>
        );
    }

    const trendInfo = getTrendIndicator();

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <div>
                    <h1>⚡ Smart Home Energy Dashboard</h1>
                    <p className="last-update">Last updated: {lastUpdate.toLocaleTimeString()}</p>
                </div>
                <div className="header-stats">
                    {trendInfo && (
                        <span className="trend-badge" style={{ color: trendInfo.color }}>
                            {trendInfo.trend} Consumption Trend
                        </span>
                    )}
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card total-consumption">
                    <div className="stat-icon">⚡</div>
                    <div className="stat-content">
                        <h3>Total Consumption</h3>
                        <p className="stat-value">{energyData?.totalConsumption?.toFixed(2) || '0.00'} <span className="unit">kWh</span></p>
                        <p className="stat-subtitle">Last 7 days</p>
                    </div>
                </div>
                
                <div className="stat-card peak-usage">
                    <div className="stat-icon">📊</div>
                    <div className="stat-content">
                        <h3>Peak Usage</h3>
                        <p className="stat-value">{energyData?.peakUsage?.toFixed(2) || '0.00'} <span className="unit">kW</span></p>
                        <p className="stat-subtitle">Maximum power draw</p>
                    </div>
                </div>
                
                <div className="stat-card estimated-cost">
                    <div className="stat-icon">💰</div>
                    <div className="stat-content">
                        <h3>Estimated Cost</h3>
                        <p className="stat-value">${energyData?.averageCost?.toFixed(2) || '0.00'}</p>
                        <p className="stat-subtitle">@$0.12 per kWh</p>
                    </div>
                </div>
                
                <div className="stat-card active-devices">
                    <div className="stat-icon">🏠</div>
                    <div className="stat-content">
                        <h3>Active Devices</h3>
                        <p className="stat-value">{devices.filter(d => d.status === 'on').length}<span className="unit">/{devices.length}</span></p>
                        <p className="stat-subtitle">Currently running</p>
                    </div>
                </div>
            </div>

            <div className="dashboard-content">
                <div className="devices-section">
                    <div className="section-header">
                        <h2>🏠 Devices Overview</h2>
                        <span className="badge">{devices.length} devices</span>
                    </div>
                    <div className="devices-grid">
                        {devices.map(device => (
                            <div key={device.id} className={`device-card-modern ${device.status}`}>
                                <div className="device-header">
                                    <span className="device-icon">{getDeviceIcon(device.type)}</span>
                                    <span className={`status-indicator ${device.status}`}></span>
                                </div>
                                <h3>{device.name}</h3>
                                <p className="device-type">{device.type}</p>
                                <div className="device-footer">
                                    <span className={`status-badge ${device.status}`}>
                                        {device.status === 'on' ? '● ACTIVE' : '○ IDLE'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="recent-activity">
                    <div className="section-header">
                        <h2>� Recent Activity</h2>
                        <span className="badge">Last 10 readings</span>
                    </div>
                    <div className="activity-list">
                        {recentData.map((item, index) => (
                            <div key={index} className="activity-item">
                                <div className="activity-icon">{getDeviceIcon('Appliance')}</div>
                                <div className="activity-content">
                                    <span className="activity-device">{item.device_name}</span>
                                    <span className="activity-time">{new Date(item.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div className="activity-value">
                                    {parseFloat(item.consumption).toFixed(3)} kWh
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="insights-section">
                <h2>💡 Smart Insights</h2>
                <div className="insights-grid">
                    <div className="insight-card">
                        <span className="insight-icon">🌟</span>
                        <div>
                            <h4>Energy Efficiency</h4>
                            <p>Your consumption is {energyData?.totalConsumption > 300 ? 'above' : 'below'} average for this week</p>
                        </div>
                    </div>
                    <div className="insight-card">
                        <span className="insight-icon">⏰</span>
                        <div>
                            <h4>Peak Hours</h4>
                            <p>Most energy consumed during evening hours (6-9 PM)</p>
                        </div>
                    </div>
                    <div className="insight-card">
                        <span className="insight-icon">💡</span>
                        <div>
                            <h4>Recommendation</h4>
                            <p>Consider using high-power devices during off-peak hours</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;