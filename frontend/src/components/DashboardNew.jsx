import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import '../styles/DashboardNew_Premium.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const Dashboard = () => {
    const navigate = useNavigate();
    const [energyData, setEnergyData] = useState(null);
    const [devices, setDevices] = useState([]);
    const [recentData, setRecentData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(new Date());
    const [quickToggleLoading, setQuickToggleLoading] = useState({});

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

    const quickToggleDevice = async (deviceId, deviceName) => {
        setQuickToggleLoading(prev => ({ ...prev, [deviceId]: true }));
        
        try {
            const response = await axios.patch(`${API_BASE_URL}/api/devices/${deviceId}/toggle`);
            setDevices(prevDevices =>
                prevDevices.map(d =>
                    d.id === deviceId ? { ...d, ...response.data } : d
                )
            );
            const newStatus = response.data.status === 'on' ? 'ON' : 'OFF';
            toast.success(`${deviceName} turned ${newStatus}`, {
                icon: newStatus === 'ON' ? '✅' : '⏸️'
            });
        } catch (error) {
            console.error('Error toggling device:', error);
            toast.error(`Failed to toggle ${deviceName}`);
        } finally {
            setQuickToggleLoading(prev => ({ ...prev, [deviceId]: false }));
        }
    };

    const getDeviceIcon = (name, type) => {
        const icons = {
            'Lights': '💡',
            'Refrigerator': '🧊',
            'AC': '❄️',
            'Washing Machine': '🧺',
            'TV': '📺'
        };
        return icons[name] || (type === 'Light' ? '💡' : type === 'Entertainment' ? '📺' : '🔌');
    };

    const getTrendIcon = (value, threshold) => {
        if (value > threshold) return { icon: '📈', class: 'trend-up', text: 'Above average' };
        if (value < threshold * 0.7) return { icon: '📉', class: 'trend-down', text: 'Below average' };
        return { icon: '➡️', class: 'trend-stable', text: 'On track' };
    };

    if (loading) {
        return (
            <div className="premium-dashboard">
                <div className="dashboard-loading">
                    <div className="spinner-premium"></div>
                    <p>Loading your smart home...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="premium-dashboard">
                <div className="dashboard-error">
                    <div className="error-icon">⚠️</div>
                    <h2>Connection Error</h2>
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()}>Retry Connection</button>
                </div>
            </div>
        );
    }

    const activeDevices = devices.filter(d => d.status === 'on').length;
    const consumptionTrend = getTrendIcon(energyData?.totalConsumption || 0, 300);
    const currentPower = devices.filter(d => d.status === 'on').reduce((sum, d) => {
        const powers = { 'Lights': 45, 'Refrigerator': 120, 'AC': 1200, 'Washing Machine': 500, 'TV': 85 };
        return sum + (powers[d.name] || 0);
    }, 0) / 1000;

    return (
        <div className="premium-dashboard">
            {/* Hero Section with Live Stats */}
            <div className="dashboard-hero">
                <div className="hero-background"></div>
                <div className="hero-content">
                    <div className="hero-header">
                        <div>
                            <h1>⚡ Energy Dashboard</h1>
                            <p className="hero-subtitle">Real-time monitoring of your smart home</p>
                        </div>
                        <div className="live-indicator">
                            <span className="live-dot"></span>
                            <span>Live</span>
                        </div>
                    </div>
                    
                    <div className="hero-stats-grid">
                        <div className="hero-stat-card" onClick={() => navigate('/analytics')}>
                            <div className="stat-icon-wrapper consumption">
                                <span className="stat-icon">⚡</span>
                            </div>
                            <div className="stat-details">
                                <span className="stat-label">Total Consumption</span>
                                <span className="stat-value">{energyData?.totalConsumption?.toFixed(1) || '0.0'} <small>kWh</small></span>
                                <div className={`stat-trend ${consumptionTrend.class}`}>
                                    <span>{consumptionTrend.icon}</span>
                                    <span>{consumptionTrend.text}</span>
                                </div>
                            </div>
                        </div>

                        <div className="hero-stat-card" onClick={() => navigate('/analytics')}>
                            <div className="stat-icon-wrapper power">
                                <span className="stat-icon">🔥</span>
                            </div>
                            <div className="stat-details">
                                <span className="stat-label">Current Power</span>
                                <span className="stat-value">{currentPower.toFixed(2)} <small>kW</small></span>
                                <div className="stat-trend trend-stable">
                                    <span>⚡</span>
                                    <span>{activeDevices} devices active</span>
                                </div>
                            </div>
                        </div>

                        <div className="hero-stat-card" onClick={() => navigate('/efficiency')}>
                            <div className="stat-icon-wrapper cost">
                                <span className="stat-icon">💰</span>
                            </div>
                            <div className="stat-details">
                                <span className="stat-label">Estimated Cost</span>
                                <span className="stat-value">${energyData?.averageCost?.toFixed(2) || '0.00'}</span>
                                <div className="stat-trend trend-down">
                                    <span>💵</span>
                                    <span>@$0.12/kWh</span>
                                </div>
                            </div>
                        </div>

                        <div className="hero-stat-card" onClick={() => navigate('/control')}>
                            <div className="stat-icon-wrapper devices">
                                <span className="stat-icon">🏠</span>
                            </div>
                            <div className="stat-details">
                                <span className="stat-label">Smart Devices</span>
                                <span className="stat-value">{activeDevices}<small>/{devices.length}</small></span>
                                <div className="stat-trend trend-up">
                                    <span>🟢</span>
                                    <span>Online & active</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="quick-actions-bar">
                <h2>⚡ Quick Actions</h2>
                <div className="quick-actions-grid">
                    <button className="quick-action-btn analytics" onClick={() => navigate('/analytics')}>
                        <span className="qa-icon">📊</span>
                        <span className="qa-text">View Analytics</span>
                    </button>
                    <button className="quick-action-btn efficiency" onClick={() => navigate('/efficiency')}>
                        <span className="qa-icon">🎯</span>
                        <span className="qa-text">Check Efficiency</span>
                    </button>
                    <button className="quick-action-btn tips" onClick={() => navigate('/recommendations')}>
                        <span className="qa-icon">💡</span>
                        <span className="qa-text">Get Tips</span>
                    </button>
                    <button className="quick-action-btn control" onClick={() => navigate('/control')}>
                        <span className="qa-icon">🎛️</span>
                        <span className="qa-text">Control Devices</span>
                    </button>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="dashboard-content-grid">
                {/* Devices Section - Now Interactive */}
                <div className="premium-card devices-card">
                    <div className="premium-card-header">
                        <div>
                            <h2>🏠 Smart Devices</h2>
                            <p className="card-subtitle">{activeDevices} of {devices.length} active</p>
                        </div>
                        <button className="view-all-btn" onClick={() => navigate('/control')}>
                            View All →
                        </button>
                    </div>
                    <div className="devices-premium-grid">
                        {devices.slice(0, 6).map(device => (
                            <div key={device.id} className={`device-mini-card ${device.status}`}>
                                <div className="device-mini-header">
                                    <div className="device-mini-icon">
                                        {getDeviceIcon(device.name, device.type)}
                                    </div>
                                    <div className={`device-mini-status ${device.status}`}>
                                        <span className="status-dot"></span>
                                    </div>
                                </div>
                                <div className="device-mini-info">
                                    <span className="device-mini-name">{device.name}</span>
                                    <span className="device-mini-type">{device.type}</span>
                                </div>
                                <button 
                                    className={`device-mini-toggle ${device.status}`}
                                    onClick={() => quickToggleDevice(device.id, device.name)}
                                    disabled={quickToggleLoading[device.id]}
                                >
                                    {quickToggleLoading[device.id] ? '⏳' : device.status === 'on' ? 'Turn Off' : 'Turn On'}
                                </button>
                            </div>
                        ))}
                    </div>
                    {devices.length > 6 && (
                        <div className="card-footer">
                            <span className="footer-text">+{devices.length - 6} more devices</span>
                            <button className="footer-link" onClick={() => navigate('/control')}>
                                Manage all devices →
                            </button>
                        </div>
                    )}
                </div>

                {/* Recent Activity with Enhanced Design */}
                <div className="premium-card activity-card">
                    <div className="premium-card-header">
                        <div>
                            <h2>📊 Energy Flow</h2>
                            <p className="card-subtitle">Real-time consumption data</p>
                        </div>
                        <span className="update-badge">
                            Updated {lastUpdate.toLocaleTimeString()}
                        </span>
                    </div>
                    <div className="activity-premium-timeline">
                        {recentData.slice(0, 8).map((item, index) => {
                            const consumption = parseFloat(item.consumption);
                            const maxConsumption = Math.max(...recentData.map(i => parseFloat(i.consumption)));
                            const percentage = (consumption / maxConsumption) * 100;
                            
                            return (
                                <div key={index} className="timeline-premium-item">
                                    <div className="timeline-icon">
                                        {getDeviceIcon(item.device_name)}
                                    </div>
                                    <div className="timeline-info">
                                        <div className="timeline-top">
                                            <span className="timeline-name">{item.device_name}</span>
                                            <span className="timeline-value">{consumption.toFixed(3)} kWh</span>
                                        </div>
                                        <div className="timeline-bar-container">
                                            <div className="timeline-bar" style={{ width: `${percentage}%` }}></div>
                                        </div>
                                        <span className="timeline-timestamp">
                                            {new Date(item.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Smart Insights - Premium Design */}
            <div className="premium-card insights-card">
                <div className="premium-card-header">
                    <div>
                        <h2>🧠 AI Insights</h2>
                        <p className="card-subtitle">Personalized recommendations for your home</p>
                    </div>
                    <button className="view-all-btn" onClick={() => navigate('/recommendations')}>
                        See All →
                    </button>
                </div>
                <div className="insights-premium-grid">
                    <div className="insight-premium-card efficiency">
                        <div className="insight-badge">
                            <span className="insight-badge-icon">⚡</span>
                            <span>Efficiency</span>
                        </div>
                        <h3>Energy Performance</h3>
                        <p>
                            {energyData?.totalConsumption > 300 
                                ? 'Your usage is above average. Check efficiency tips to optimize consumption.' 
                                : 'Great work! Your energy usage is below average. Keep it up!'}
                        </p>
                        <div className="insight-metric">
                            <span className="metric-label">Current Score:</span>
                            <span className={`metric-value ${energyData?.totalConsumption > 300 ? 'warning' : 'success'}`}>
                                {energyData?.totalConsumption > 300 ? 'Needs Improvement' : 'Excellent'}
                            </span>
                        </div>
                    </div>

                    <div className="insight-premium-card peak">
                        <div className="insight-badge">
                            <span className="insight-badge-icon">📈</span>
                            <span>Peak Hours</span>
                        </div>
                        <h3>Usage Patterns</h3>
                        <p>
                            Peak consumption detected between 6-9 PM. Shifting high-power device usage can reduce costs.
                        </p>
                        <div className="insight-metric">
                            <span className="metric-label">Potential Savings:</span>
                            <span className="metric-value success">$12-15/month</span>
                        </div>
                    </div>

                    <div className="insight-premium-card savings">
                        <div className="insight-badge">
                            <span className="insight-badge-icon">💰</span>
                            <span>Cost Savings</span>
                        </div>
                        <h3>Smart Scheduling</h3>
                        <p>
                            Run washing machine and AC during off-peak hours (10 PM - 6 AM) to save on electricity bills.
                        </p>
                        <div className="insight-metric">
                            <span className="metric-label">Impact:</span>
                            <span className="metric-value success">High</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
