import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { toast } from 'react-toastify';
import '../styles/MLPredictions.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;

const MLPredictions = () => {
    const [predictions, setPredictions] = useState(null);
    const [summary, setSummary] = useState(null);
    const [modelInfo, setModelInfo] = useState(null);
    const [allModels, setAllModels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [training, setTraining] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState('all');
    const [hours, setHours] = useState(24);

    useEffect(() => {
        fetchPredictions();
        fetchSummary();
        fetchAllModels();
        if (selectedDevice !== 'all') {
            fetchModelInfo();
        }
    }, [hours, selectedDevice]);

    const fetchPredictions = async () => {
        setLoading(true);
        try {
            const url = selectedDevice === 'all' 
                ? `${API_BASE_URL}/api/ml/predictions?hours=${hours}`
                : `${API_BASE_URL}/api/ml/device/${selectedDevice}/predictions?hours=${hours}`;
            
            const response = await axios.get(url);
            setPredictions(response.data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching predictions:', err);
            toast.error('Failed to load predictions. Train models first!');
            setLoading(false);
        }
    };

    const fetchSummary = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/ml/predictions/summary?hours=${hours}`);
            setSummary(response.data);
        } catch (err) {
            console.error('Error fetching summary:', err);
        }
    };

    const fetchAllModels = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/ml/models`);
            setAllModels(response.data.models || []);
        } catch (err) {
            console.error('Error fetching models:', err);
        }
    };

    const fetchModelInfo = async () => {
        if (selectedDevice === 'all') {
            setModelInfo(null);
            return;
        }
        
        try {
            const response = await axios.get(`${API_BASE_URL}/api/ml/device/${selectedDevice}/model-info`);
            setModelInfo(response.data);
        } catch (err) {
            console.error('Error fetching model info:', err);
            setModelInfo(null);
        }
    };

    const trainModels = async () => {
        setTraining(true);
        try {
            const url = selectedDevice === 'all'
                ? `${API_BASE_URL}/api/ml/train`
                : `${API_BASE_URL}/api/ml/train?device=${selectedDevice}`;
            
            const response = await axios.post(url);
            
            if (response.data.success) {
                toast.success('Models trained successfully!');
                fetchPredictions();
                fetchSummary();
                fetchAllModels();
                if (selectedDevice !== 'all') {
                    fetchModelInfo();
                }
            } else {
                toast.error('Training failed. Check if you have enough historical data (7 days required)');
            }
        } catch (err) {
            console.error('Error training models:', err);
            toast.error('Failed to train models');
        } finally {
            setTraining(false);
        }
    };

    const getChartData = () => {
        if (!predictions || !predictions.success) return null;

        if (selectedDevice === 'all' && predictions.devices) {
            // Multi-device chart
            const datasets = Object.entries(predictions.devices).map(([deviceName, deviceData], index) => {
                const colors = ['#10B981', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6'];
                const color = colors[index % colors.length];
                
                return {
                    label: deviceName,
                    data: deviceData.hourly_predictions?.map(p => p.predicted_consumption) || [],
                    borderColor: color,
                    backgroundColor: `${color}20`,
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                };
            });

            const firstDevice = Object.values(predictions.devices)[0];
            const labels = firstDevice?.hourly_predictions?.map(p => {
                const date = new Date(p.timestamp);
                return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            }) || [];

            return { labels, datasets };
        } else if (predictions.hourly_predictions) {
            // Single device chart
            return {
                labels: predictions.hourly_predictions.map(p => {
                    const date = new Date(p.timestamp);
                    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                }),
                datasets: [{
                    label: 'Predicted Consumption (kWh)',
                    data: predictions.hourly_predictions.map(p => p.predicted_consumption),
                    borderColor: '#10B981',
                    backgroundColor: '#10B98120',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            };
        }
        
        return null;
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    color: '#1F2937',
                    font: { size: 12, weight: '500' }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(31, 41, 55, 0.9)',
                titleColor: '#fff',
                bodyColor: '#fff',
                padding: 12,
                displayColors: true,
                callbacks: {
                    label: (context) => {
                        return `${context.dataset.label}: ${context.parsed.y.toFixed(4)} kWh`;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { 
                    color: '#6B7280',
                    maxRotation: 45,
                    minRotation: 45
                }
            },
            y: {
                beginAtZero: true,
                grid: { color: '#E5E7EB' },
                ticks: { 
                    color: '#6B7280',
                    callback: (value) => `${value} kWh`
                }
            }
        }
    };

    if (loading && !predictions) {
        return (
            <div className="ml-predictions-container">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Loading predictions...</p>
                </div>
            </div>
        );
    }

    const chartData = getChartData();

    return (
        <div className="ml-predictions-container">
            <div className="ml-header">
                <div>
                    <h1>🤖 ML Energy Predictions</h1>
                    <p>Machine Learning-powered consumption forecasts</p>
                </div>
                <button 
                    className={`train-btn ${training ? 'training' : ''}`}
                    onClick={trainModels}
                    disabled={training}
                >
                    {training ? '⏳ Training...' : '🧠 Train Models'}
                </button>
            </div>

            <div className="controls-panel">
                <div className="control-group">
                    <label>Device:</label>
                    <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}>
                        <option value="all">All Devices</option>
                        <option value="washing_machine">Washing Machine</option>
                        <option value="refrigerator">Refrigerator</option>
                        <option value="air_conditioner">Air Conditioner</option>
                        <option value="dishwasher">Dishwasher</option>
                        <option value="water_heater">Water Heater</option>
                    </select>
                </div>
                <div className="control-group">
                    <label>Prediction Period:</label>
                    <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                        <option value="6">Next 6 Hours</option>
                        <option value="12">Next 12 Hours</option>
                        <option value="24">Next 24 Hours</option>
                        <option value="48">Next 48 Hours</option>
                    </select>
                </div>
            </div>

            {summary && summary.success && (
                <div className="summary-cards">
                    <div className="summary-card">
                        <div className="card-icon">⚡</div>
                        <div className="card-content">
                            <h3>Next {hours}h Prediction</h3>
                            <p className="value">{summary.next_24h.total_kwh} kWh</p>
                            <p className="cost">${summary.next_24h.total_cost}</p>
                        </div>
                    </div>
                    <div className="summary-card">
                        <div className="card-icon">📅</div>
                        <div className="card-content">
                            <h3>Daily Projection</h3>
                            <p className="value">{summary.projected_daily.total_kwh} kWh</p>
                            <p className="cost">${summary.projected_daily.total_cost}/day</p>
                        </div>
                    </div>
                    <div className="summary-card">
                        <div className="card-icon">💰</div>
                        <div className="card-content">
                            <h3>Monthly Projection</h3>
                            <p className="value">{summary.projected_monthly.total_kwh} kWh</p>
                            <p className="cost">${summary.projected_monthly.total_cost}/month</p>
                        </div>
                    </div>
                </div>
            )}

            {chartData && (
                <div className="chart-container">
                    <h2>Predicted Consumption Timeline</h2>
                    <div className="chart-wrapper">
                        <Line data={chartData} options={chartOptions} />
                    </div>
                </div>
            )}

            {modelInfo && (
                <div className="model-info-panel">
                    <div className="model-info-header">
                        <div>
                            <h2>📊 Model Details: {modelInfo.device_name}</h2>
                            <p className="model-info-subtitle">Detailed performance metrics and configuration</p>
                        </div>
                        <button className="back-btn" onClick={() => setSelectedDevice('all')}>
                            ← Back to All Models
                        </button>
                    </div>
                    
                    <div className="model-grid">
                        <div className="info-card highlight-card">
                            <div className="card-icon">🤖</div>
                            <div className="card-content">
                                <h3>Algorithm</h3>
                                <p className="algorithm-name">{modelInfo.algorithm}</p>
                                <p className="model-type">{modelInfo.model_type}</p>
                            </div>
                        </div>
                        
                        <div className="info-card highlight-card">
                            <div className="card-icon">📈</div>
                            <div className="card-content">
                                <h3>Performance Score</h3>
                                <div className="metric-row">
                                    <span className="metric-label">R² Score:</span>
                                    <span className={`metric-value-large ${getR2Class(modelInfo.metrics.test_r2_score)}`}>
                                        {(modelInfo.metrics.test_r2_score * 100).toFixed(1)}%
                                    </span>
                                </div>
                                <div className="r2-bar-container">
                                    <div 
                                        className={`r2-bar ${getR2Class(modelInfo.metrics.test_r2_score)}`}
                                        style={{ width: `${Math.max(modelInfo.metrics.test_r2_score * 100, 2)}%` }}
                                    ></div>
                                </div>
                                <p className="metric-interpretation">{modelInfo.metrics.r2_interpretation}</p>
                            </div>
                        </div>
                        
                        <div className="info-card">
                            <div className="card-icon">📊</div>
                            <div className="card-content">
                                <h3>Training Details</h3>
                                <p><strong>Samples:</strong> {modelInfo.training_info.training_samples.toLocaleString()}</p>
                                <p><strong>Trained:</strong> {new Date(modelInfo.training_info.training_date).toLocaleDateString()}</p>
                                <p><strong>Features:</strong> {modelInfo.training_info.features_used.length}</p>
                            </div>
                        </div>
                        
                        <div className="info-card features-card">
                            <div className="card-icon">🔬</div>
                            <div className="card-content">
                                <h3>Features Used ({modelInfo.training_info.features_used.length})</h3>
                                <ul className="features-list">
                                    {Object.entries(modelInfo.feature_explanation).map(([key, desc]) => (
                                        <li key={key}>
                                            <span className="feature-name">{key}</span>
                                            <span className="feature-desc">{desc}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {allModels.length > 0 && selectedDevice === 'all' && (
                <div className="all-models-panel">
                    <div className="models-header">
                        <div>
                            <h2>📈 All Trained Models</h2>
                            <p className="models-subtitle">Performance metrics for all device prediction models</p>
                        </div>
                        <button className="retrain-all-btn" onClick={() => trainModels()} disabled={training}>
                            {training ? '⏳ Training...' : '🔄 Retrain All'}
                        </button>
                    </div>
                    
                    <div className="models-grid">
                        {allModels.map((model, index) => (
                            <div key={index} className="model-card">
                                <div className="model-card-header">
                                    <h3 className="device-name">{model.device_name}</h3>
                                    <span className={`status-pill ${model.use_simple_model ? 'simple' : 'ml'}`}>
                                        {model.use_simple_model ? '📊 Simple Avg' : '🤖 ML Model'}
                                    </span>
                                </div>
                                
                                <div className="model-card-body">
                                    <div className="metric-group">
                                        <label>R² Score</label>
                                        <div className="r2-display">
                                            <span className={`r2-value ${getR2Class(model.test_r2_score)}`}>
                                                {(model.test_r2_score * 100).toFixed(1)}%
                                            </span>
                                            <span className="r2-quality">{getQualityText(model.test_r2_score)}</span>
                                        </div>
                                        <div className="r2-bar-container">
                                            <div 
                                                className={`r2-bar ${getR2Class(model.test_r2_score)}`}
                                                style={{ width: `${Math.max(model.test_r2_score * 100, 2)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    
                                    <div className="model-stats">
                                        <div className="stat-item">
                                            <span className="stat-icon">🔬</span>
                                            <div>
                                                <div className="stat-label">Algorithm</div>
                                                <div className="stat-value">Linear Regression</div>
                                            </div>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-icon">📊</span>
                                            <div>
                                                <div className="stat-label">Training Data</div>
                                                <div className="stat-value">{model.training_samples.toLocaleString()} samples</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="model-card-footer">
                                    <button 
                                        className="view-details-btn"
                                        onClick={() => setSelectedDevice(model.device_name)}
                                    >
                                        View Details →
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {summary && summary.device_breakdown && (
                <div className="device-breakdown">
                    <h2>Device Breakdown</h2>
                    <div className="breakdown-table">
                        {summary.device_breakdown.map((device, index) => (
                            <div key={index} className="breakdown-row">
                                <div className="device-name">{device.device_name}</div>
                                <div className="device-bar">
                                    <div 
                                        className="bar-fill" 
                                        style={{ width: `${device.percentage}%` }}
                                    ></div>
                                </div>
                                <div className="device-stats">
                                    <span className="kwh">{device.predicted_kwh} kWh</span>
                                    <span className="cost">${device.predicted_cost}</span>
                                    <span className="percentage">{device.percentage}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!predictions?.success && (
                <div className="no-data-message">
                    <h3>⚠️ No Predictions Available</h3>
                    <p>Train the ML models first to see predictions.</p>
                    <p>Note: Requires at least 7 days of historical data.</p>
                    <button className="train-btn" onClick={trainModels} disabled={training}>
                        {training ? 'Training...' : 'Train Models Now'}
                    </button>
                </div>
            )}
        </div>
    );
};

const getR2Class = (r2Score) => {
    if (r2Score >= 0.7) return 'r2-good';
    if (r2Score >= 0.5) return 'r2-moderate';
    if (r2Score >= 0.3) return 'r2-fair';
    return 'r2-poor';
};

const getQualityBadge = (r2Score) => {
    if (r2Score >= 0.9) return '🟢 Excellent';
    if (r2Score >= 0.7) return '🟢 Good';
    if (r2Score >= 0.5) return '🟡 Moderate';
    if (r2Score >= 0.3) return '🟠 Fair';
    return '🔴 Poor';
};

const getQualityText = (r2Score) => {
    if (r2Score >= 0.9) return 'Excellent';
    if (r2Score >= 0.7) return 'Good';
    if (r2Score >= 0.5) return 'Moderate';
    if (r2Score >= 0.3) return 'Fair';
    return 'Poor';
};

export default MLPredictions;
