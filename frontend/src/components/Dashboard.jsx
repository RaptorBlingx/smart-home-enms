import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/DashboardNew.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;

const Dashboard = () => {
    const [energyData, setEnergyData] = useState(null);
    const [costData, setCostData] = useState(null);
    const [devices, setDevices] = useState([]);
    const [recentData, setRecentData] = useState([]);
    const [predictions, setPredictions] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(new Date());

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [energyResponse, devicesResponse, consumptionResponse, costResponse, predictionsResponse] = await Promise.all([
                    axios.get(`${API_BASE_URL}/api/energy`),
                    axios.get(`${API_BASE_URL}/api/devices`),
                    axios.get(`${API_BASE_URL}/api/energy/consumption`),
                    axios.get(`${API_BASE_URL}/api/energy/cost?period=7days`),
                    axios.get(`${API_BASE_URL}/api/ml/predictions/summary?hours=24`)
                ]);
                
                setEnergyData(energyResponse.data);
                setDevices(devicesResponse.data);
                setRecentData(consumptionResponse.data.slice(0, 10));
                setCostData(costResponse.data);
                setPredictions(predictionsResponse.data);
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

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="spinner"></div>
                <p>Loading your smart home data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-error">
                <div className="error-icon">⚠️</div>
                <h2>Connection Error</h2>
                <p>{error}</p>
                <button onClick={() => window.location.reload()}>Retry</button>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            {/* Header Section */}
            <div className="dashboard-header-section">
                <div className="header-content">
                    <h1>⚡ Energy Dashboard</h1>
                    <p className="update-time">Last updated: {lastUpdate.toLocaleTimeString()}</p>
                </div>
            </div>

            {/* Main Stats Cards */}
            <div className="stats-container">
                <div className="stat-box stat-primary">
                    <div className="stat-label">Total Consumption</div>
                    <div className="stat-number">{energyData?.totalConsumption?.toFixed(2) || '0.00'}</div>
                    <div className="stat-unit">kWh (Last 7 days)</div>
                </div>
                
                <div className="stat-box stat-secondary">
                    <div className="stat-label">Peak Usage</div>
                    <div className="stat-number">{energyData?.peakUsage?.toFixed(2) || '0.00'}</div>
                    <div className="stat-unit">kW (Maximum)</div>
                </div>
                
                <div className="stat-box stat-tertiary">
                    <div className="stat-label">Total Cost (7 Days)</div>
                    <div className="stat-number">${costData?.totalCost?.toFixed(2) || '0.00'}</div>
                    <div className="stat-unit">USD (@${costData?.electricityRate || 0.12}/kWh)</div>
                </div>
                
                <div className="stat-box stat-quaternary">
                    <div className="stat-label">Projected Monthly</div>
                    <div className="stat-number">${costData?.projectedMonthlyCost?.toFixed(2) || '0.00'}</div>
                    <div className="stat-unit">Estimated Cost</div>
                </div>
            </div>

            {/* Cost Breakdown Section */}
            {costData && costData.devicesCost && costData.devicesCost.length > 0 && (
                <div className="dashboard-card cost-breakdown-card">
                    <div className="card-header">
                        <h2>💰 Cost Breakdown by Device</h2>
                        <span className="cost-period">Last 7 Days</span>
                    </div>
                    <div className="cost-breakdown-list">
                        {costData.devicesCost.map((device, index) => (
                            <div key={index} className="cost-item">
                                <div className="cost-item-header">
                                    <span className="cost-device-name">
                                        {device.device === 'Living Room Light' ? '💡' : 
                                         device.device === 'TV' ? '📺' : 
                                         device.device.includes('AC') ? '❄️' : 
                                         device.device.includes('Refrigerator') ? '🧊' : '🔌'}
                                        {' '}{device.device}
                                    </span>
                                    <span className="cost-amount">${device.cost.toFixed(2)}</span>
                                </div>
                                <div className="cost-item-details">
                                    <span className="cost-consumption">{device.consumption.toFixed(2)} kWh</span>
                                    <div className="cost-bar-container">
                                        <div 
                                            className="cost-bar" 
                                            style={{width: `${device.percentage}%`}}
                                        ></div>
                                    </div>
                                    <span className="cost-percentage">{device.percentage}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ML Predictions Section */}
            {predictions && predictions.success && (
                <div className="dashboard-card predictions-card">
                    <div className="card-header">
                        <h2>🤖 AI-Powered Predictions</h2>
                        <span className="predictions-badge">Machine Learning</span>
                    </div>
                    
                    <div className="predictions-summary">
                        <div className="prediction-stat">
                            <div className="prediction-label">Next 24 Hours</div>
                            <div className="prediction-value">{predictions.next_24h?.total_kwh?.toFixed(2) || '0.00'} kWh</div>
                            <div className="prediction-cost">${predictions.next_24h?.total_cost?.toFixed(2) || '0.00'}</div>
                        </div>
                        
                        <div className="prediction-stat">
                            <div className="prediction-label">Projected Daily</div>
                            <div className="prediction-value">{predictions.projected_daily?.total_kwh?.toFixed(2) || '0.00'} kWh</div>
                            <div className="prediction-cost">${predictions.projected_daily?.total_cost?.toFixed(2) || '0.00'}/day</div>
                        </div>
                        
                        <div className="prediction-stat prediction-highlight">
                            <div className="prediction-label">Projected Monthly</div>
                            <div className="prediction-value">{predictions.projected_monthly?.total_kwh?.toFixed(2) || '0.00'} kWh</div>
                            <div className="prediction-cost">${predictions.projected_monthly?.total_cost?.toFixed(2) || '0.00'}/month</div>
                        </div>
                    </div>
                    
                    {predictions.device_breakdown && predictions.device_breakdown.length > 0 && (
                        <div className="predictions-breakdown">
                            <h3>Predicted Consumption by Device (Next 24h)</h3>
                            <div className="predictions-list">
                                {predictions.device_breakdown.slice(0, 5).map((device, index) => (
                                    <div key={index} className="prediction-device-item">
                                        <div className="prediction-device-header">
                                            <span className="prediction-device-name">
                                                {device.device_name === 'Lights' ? '💡' : 
                                                 device.device_name === 'TV' ? '📺' : 
                                                 device.device_name === 'AC' ? '❄️' : 
                                                 device.device_name === 'Refrigerator' ? '🧊' : 
                                                 device.device_name === 'Washing Machine' ? '🌀' : '🔌'}
                                                {' '}{device.device_name}
                                            </span>
                                            <span className="prediction-device-value">
                                                {device.predicted_kwh?.toFixed(2)} kWh
                                                <span className="prediction-device-cost"> (${device.predicted_cost?.toFixed(2)})</span>
                                            </span>
                                        </div>
                                        <div className="prediction-bar-container">
                                            <div 
                                                className="prediction-bar" 
                                                style={{width: `${device.percentage}%`}}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div className="predictions-footer">
                        <span className="predictions-note">
                            ⓘ Predictions are based on historical patterns using machine learning algorithms
                        </span>
                    </div>
                </div>
            )}

            {/* Two Column Layout */}
            <div className="dashboard-grid">
                {/* Left Column - Devices */}
                <div className="dashboard-card">
                    <div className="card-header">
                        <h2>🏠 Smart Devices</h2>
                        <span className="device-count">{devices.length} devices</span>
                    </div>
                    <div className="devices-list">
                        {devices.map(device => {
                            const deviceCost = costData?.devicesCost?.find(d => d.device === device.name);
                            return (
                                <div key={device.id} className={`device-item ${device.status}`}>
                                    <div className="device-info">
                                        <div className="device-icon-name">
                                            <span className="device-emoji">
                                                {device.type === 'Light' ? '💡' : 
                                                 device.type === 'Entertainment' ? '📺' : 
                                                 device.name.includes('AC') ? '❄️' : 
                                                 device.name.includes('Refrigerator') ? '🧊' : '🔌'}
                                            </span>
                                            <div>
                                                <div className="device-name">{device.name}</div>
                                                <div className="device-type">
                                                    {device.type}
                                                    {deviceCost && (
                                                        <span className="device-cost-tag"> • ${deviceCost.cost.toFixed(2)}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`device-badge ${device.status}`}>
                                            {device.status === 'on' ? '● ON' : '○ OFF'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Column - Activity */}
                <div className="dashboard-card">
                    <div className="card-header">
                        <h2>📊 Recent Activity</h2>
                        <span className="activity-count">Last 10 readings</span>
                    </div>
                    <div className="activity-timeline">
                        {recentData.map((item, index) => {
                            const itemCost = (parseFloat(item.consumption) * (costData?.electricityRate || 0.12)).toFixed(4);
                            return (
                                <div key={index} className="timeline-item">
                                    <div className="timeline-dot"></div>
                                    <div className="timeline-content">
                                        <div className="timeline-device">{item.device_name}</div>
                                        <div className="timeline-details">
                                            <span className="timeline-value">
                                                {parseFloat(item.consumption).toFixed(3)} kWh
                                                <span className="timeline-cost"> (${itemCost})</span>
                                            </span>
                                            <span className="timeline-time">{new Date(item.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Insights Section */}
            <div className="insights-container">
                <h2 className="insights-title">💡 Smart Insights & Recommendations</h2>
                <div className="insights-grid">
                    <div className="insight-box insight-efficiency">
                        <div className="insight-icon">⚡</div>
                        <div className="insight-content">
                            <h3>Energy Efficiency</h3>
                            <p>Your consumption is {energyData?.totalConsumption > 300 ? 'above' : 'below'} average for this period. {energyData?.totalConsumption > 300 ? 'Consider optimizing usage.' : 'Great job!'}</p>
                        </div>
                    </div>
                    
                    <div className="insight-box insight-peak">
                        <div className="insight-icon">📈</div>
                        <div className="insight-content">
                            <h3>Cost Savings Potential</h3>
                            <p>
                                {costData?.devicesCost && costData.devicesCost.length > 0 
                                    ? `${costData.devicesCost[0].device} is your highest consumer at $${costData.devicesCost[0].cost.toFixed(2)}. Consider optimizing its usage.`
                                    : 'Keep monitoring your devices for optimization opportunities.'}
                            </p>
                        </div>
                    </div>
                    
                    <div className="insight-box insight-savings">
                        <div className="insight-icon">💰</div>
                        <div className="insight-content">
                            <h3>Monthly Budget</h3>
                            <p>Based on current usage, your projected monthly cost is ${costData?.projectedMonthlyCost?.toFixed(2) || '0.00'}. Track daily to stay within budget.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
