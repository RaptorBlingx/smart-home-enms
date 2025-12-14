import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import '../styles/Analytics_Premium.css';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const Analytics = () => {
    const [statsData, setStatsData] = useState(null);
    const [period, setPeriod] = useState('7d');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(new Date());

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/api/energy/stats?period=${period}`);
                setStatsData(response.data);
                setLastUpdate(new Date());
                setLoading(false);
                setError(null);
            } catch (error) {
                console.error('Error fetching analytics:', error);
                setError(error.message || 'Failed to fetch analytics data');
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 30000); // Update every 30 seconds
        return () => clearInterval(interval);
    }, [period]);

    if (loading) {
        return (
            <div className="analytics-loading">
                <div className="spinner"></div>
                <p>Loading analytics...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="analytics-error">
                <div className="error-icon">⚠️</div>
                <h2>Error Loading Analytics</h2>
                <p>{error}</p>
                <button onClick={() => window.location.reload()}>Retry</button>
            </div>
        );
    }

    // Prepare time series chart data
    const timeseriesLabels = statsData?.timeseries?.map(item => {
        const date = new Date(item.period);
        if (period === '24h') {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } else if (period === '7d' || period === '30d') {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }
    }) || [];

    const timeseriesData = {
        labels: timeseriesLabels,
        datasets: [
            {
                label: 'Energy Consumption (kWh)',
                data: statsData?.timeseries?.map(item => item.totalConsumption) || [],
                borderColor: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: '#10B981',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                borderWidth: 3
            },
            {
                label: 'Cost ($)',
                data: statsData?.timeseries?.map(item => item.cost) || [],
                borderColor: '#14B8A6',
                backgroundColor: 'rgba(20, 184, 166, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: '#14B8A6',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                borderWidth: 3,
                yAxisID: 'y1'
            }
        ]
    };

    const timeseriesOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    font: { size: 13, family: 'Inter', weight: '600' },
                    padding: 20,
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            title: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                padding: 16,
                titleFont: { size: 15, weight: '700' },
                bodyFont: { size: 14 },
                borderColor: '#10B981',
                borderWidth: 2,
                cornerRadius: 12
            }
        },
        scales: {
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                    display: true,
                    text: 'Energy (kWh)',
                    font: { size: 12 }
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                }
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: {
                    display: true,
                    text: 'Cost ($)',
                    font: { size: 12 }
                },
                grid: {
                    drawOnChartArea: false,
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        }
    };

    // Device comparison bar chart
    const deviceLabels = statsData?.deviceTotals?.map(item => item.device) || [];
    const deviceBarData = {
        labels: deviceLabels,
        datasets: [
            {
                label: 'Consumption (kWh)',
                data: statsData?.deviceTotals?.map(item => item.totalConsumption) || [],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.9)',
                    'rgba(20, 184, 166, 0.9)',
                    'rgba(52, 211, 153, 0.9)',
                    'rgba(4, 120, 87, 0.9)',
                    'rgba(252, 211, 77, 0.9)',
                ],
                borderColor: [
                    '#10B981',
                    '#14B8A6',
                    '#34D399',
                    '#047857',
                    '#FCD34D',
                ],
                borderWidth: 2,
                borderRadius: 12,
                borderSkipped: false
            }
        ]
    };

    const deviceBarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                padding: 16,
                borderColor: '#10B981',
                borderWidth: 2,
                cornerRadius: 12,
                titleFont: { size: 15, weight: '700' },
                bodyFont: { size: 14 }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Consumption (kWh)',
                    font: { size: 13, weight: '600', family: 'Inter' }
                },
                grid: {
                    color: 'rgba(16, 185, 129, 0.1)',
                    drawBorder: false
                },
                ticks: {
                    font: { size: 12, family: 'Inter' }
                }
            },
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    font: { size: 12, family: 'Inter', weight: '600' }
                }
            }
        }
    };

    // Device distribution pie chart
    const devicePieData = {
        labels: deviceLabels,
        datasets: [
            {
                data: statsData?.deviceTotals?.map(item => item.totalConsumption) || [],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.9)',
                    'rgba(20, 184, 166, 0.9)',
                    'rgba(52, 211, 153, 0.9)',
                    'rgba(4, 120, 87, 0.9)',
                    'rgba(252, 211, 77, 0.9)',
                ],
                borderColor: 'white',
                borderWidth: 4,
                hoverBorderWidth: 6,
                hoverOffset: 15
            }
        ]
    };

    const devicePieOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: {
                    font: { size: 12, family: 'Inter', weight: '600' },
                    padding: 18,
                    usePointStyle: true,
                    pointStyle: 'circle',
                    generateLabels: (chart) => {
                        const data = chart.data;
                        if (data.labels.length && data.datasets.length) {
                            return data.labels.map((label, i) => {
                                const value = data.datasets[0].data[i];
                                return {
                                    text: `${label}: ${value.toFixed(2)} kWh`,
                                    fillStyle: data.datasets[0].backgroundColor[i],
                                    hidden: false,
                                    index: i
                                };
                            });
                        }
                        return [];
                    }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                padding: 16,
                borderColor: '#10B981',
                borderWidth: 2,
                cornerRadius: 12,
                titleFont: { size: 15, weight: '700' },
                bodyFont: { size: 14 },
                callbacks: {
                    label: (context) => {
                        const label = context.label || '';
                        const value = context.parsed || 0;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(1);
                        return `${label}: ${value.toFixed(2)} kWh (${percentage}%)`;
                    }
                }
            }
        },
        cutout: '60%'
    };

    return (
        <div className="premium-analytics">
            {/* Hero Header */}
            <div className="analytics-hero">
                <div className="hero-bg"></div>
                <div className="hero-content-wrapper">
                    <div className="hero-text">
                        <h1>📊 Energy Analytics</h1>
                        <p className="hero-subtitle">Deep insights into your energy consumption patterns</p>
                    </div>
                    <div className="period-selector-premium">
                        <button 
                            className={period === '24h' ? 'active' : ''} 
                            onClick={() => setPeriod('24h')}
                        >
                            <span className="period-icon">📅</span>
                            <span>24H</span>
                        </button>
                        <button 
                            className={period === '7d' ? 'active' : ''} 
                            onClick={() => setPeriod('7d')}
                        >
                            <span className="period-icon">📆</span>
                            <span>7D</span>
                        </button>
                        <button 
                            className={period === '30d' ? 'active' : ''} 
                            onClick={() => setPeriod('30d')}
                        >
                            <span className="period-icon">📊</span>
                            <span>30D</span>
                        </button>
                        <button 
                            className={period === '1y' ? 'active' : ''} 
                            onClick={() => setPeriod('1y')}
                        >
                            <span className="period-icon">📈</span>
                            <span>1Y</span>
                        </button>
                    </div>
                </div>
                <div className="update-badge-premium">
                    <span className="update-dot"></span>
                    <span>Updated {lastUpdate.toLocaleTimeString()}</span>
                </div>
            </div>

            {/* Premium Summary Cards */}
            <div className="analytics-summary-premium">
                <div className="summary-card-premium consumption">
                    <div className="summary-icon-wrapper">
                        <span className="summary-icon-large">⚡</span>
                    </div>
                    <div className="summary-details">
                        <div className="summary-label-premium">Total Consumption</div>
                        <div className="summary-value-premium">{statsData?.summary?.totalConsumption?.toFixed(2) || '0.00'} <span className="unit">kWh</span></div>
                        <div className="summary-progress">
                            <div className="progress-bar-mini" style={{width: '75%'}}></div>
                        </div>
                        <div className="summary-footer-text">
                            {statsData?.summary?.totalReadings || 0} data points analyzed
                        </div>
                    </div>
                </div>

                <div className="summary-card-premium peak">
                    <div className="summary-icon-wrapper">
                        <span className="summary-icon-large">📈</span>
                    </div>
                    <div className="summary-details">
                        <div className="summary-label-premium">Peak Usage</div>
                        <div className="summary-value-premium">{statsData?.summary?.peakConsumption?.toFixed(3) || '0.000'} <span className="unit">kW</span></div>
                        <div className="summary-progress">
                            <div className="progress-bar-mini peak-bar" style={{width: '85%'}}></div>
                        </div>
                        <div className="summary-footer-text">Maximum power draw</div>
                    </div>
                </div>

                <div className="summary-card-premium cost">
                    <div className="summary-icon-wrapper">
                        <span className="summary-icon-large">💰</span>
                    </div>
                    <div className="summary-details">
                        <div className="summary-label-premium">Total Cost</div>
                        <div className="summary-value-premium">${statsData?.summary?.totalCost?.toFixed(2) || '0.00'}</div>
                        <div className="summary-progress">
                            <div className="progress-bar-mini cost-bar" style={{width: '60%'}}></div>
                        </div>
                        <div className="summary-footer-text">@$0.12 per kWh</div>
                    </div>
                </div>

                <div className="summary-card-premium average">
                    <div className="summary-icon-wrapper">
                        <span className="summary-icon-large">📊</span>
                    </div>
                    <div className="summary-details">
                        <div className="summary-label-premium">Average Daily</div>
                        <div className="summary-value-premium">{((statsData?.summary?.totalConsumption || 0) / (period === '24h' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 365)).toFixed(2)} <span className="unit">kWh</span></div>
                        <div className="summary-progress">
                            <div className="progress-bar-mini avg-bar" style={{width: '70%'}}></div>
                        </div>
                        <div className="summary-footer-text">Per day consumption</div>
                    </div>
                </div>
            </div>

            {/* Premium Charts Grid */}
            <div className="charts-grid-premium">
                {/* Time Series Chart - Full Width */}
                <div className="chart-card-premium chart-full-width">
                    <div className="chart-header-premium">
                        <div>
                            <h2>📈 Consumption & Cost Trends</h2>
                            <p className="chart-description">Track your energy usage and costs over time</p>
                        </div>
                        <div className="chart-badge">Dual Axis</div>
                    </div>
                    <div className="chart-content-premium" style={{ height: '380px' }}>
                        <Line data={timeseriesData} options={timeseriesOptions} />
                    </div>
                </div>

                {/* Device Bar Chart */}
                <div className="chart-card-premium">
                    <div className="chart-header-premium">
                        <div>
                            <h2>📊 Device Rankings</h2>
                            <p className="chart-description">Consumption by device</p>
                        </div>
                        <div className="chart-badge">Top Consumers</div>
                    </div>
                    <div className="chart-content-premium" style={{ height: '340px' }}>
                        <Bar data={deviceBarData} options={deviceBarOptions} />
                    </div>
                </div>

                {/* Device Pie Chart */}
                <div className="chart-card-premium">
                    <div className="chart-header-premium">
                        <div>
                            <h2>🍩 Energy Split</h2>
                            <p className="chart-description">Distribution breakdown</p>
                        </div>
                        <div className="chart-badge">Percentage View</div>
                    </div>
                    <div className="chart-content-premium" style={{ height: '340px' }}>
                        <Doughnut data={devicePieData} options={devicePieOptions} />
                    </div>
                </div>
            </div>

            {/* Premium Device Details Table */}
            <div className="details-card-premium">
                <div className="details-header-premium">
                    <div>
                        <h2>📋 Device Performance Details</h2>
                        <p className="details-subtitle">Comprehensive breakdown of all devices</p>
                    </div>
                    <div className="export-btn">
                        <span>📥</span>
                        <span>Export Data</span>
                    </div>
                </div>
                <div className="details-table-premium">
                    <table>
                        <thead>
                            <tr>
                                <th>Device</th>
                                <th>Total Consumption</th>
                                <th>Average</th>
                                <th>Readings</th>
                                <th>Distribution</th>
                                <th>Est. Cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            {statsData?.deviceTotals?.map((device, index) => (
                                <tr key={index} className="table-row-premium">
                                    <td className="device-name-cell-premium">
                                        <div className="device-cell-content">
                                            <span className="device-icon-table">
                                                {device.device.includes('Light') ? '💡' : 
                                                 device.device.includes('TV') ? '📺' : 
                                                 device.device.includes('AC') ? '❄️' : 
                                                 device.device.includes('Refrigerator') ? '🧊' : '🔌'}
                                            </span>
                                            <div>
                                                <div className="device-name-text">{device.device}</div>
                                                <div className="device-type-text">Smart Device</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="consumption-cell-premium">
                                        <div className="cell-with-badge">
                                            <span className="value-primary">{device.totalConsumption.toFixed(2)}</span>
                                            <span className="unit-badge">kWh</span>
                                        </div>
                                    </td>
                                    <td className="average-cell">
                                        <div className="cell-with-badge">
                                            <span className="value-secondary">{device.avgConsumption.toFixed(4)}</span>
                                            <span className="unit-badge-small">kWh</span>
                                        </div>
                                    </td>
                                    <td className="readings-cell">
                                        <div className="readings-badge">{device.readings}</div>
                                    </td>
                                    <td className="percentage-cell">
                                        <div className="percentage-bar-container">
                                            <div className="percentage-bar-fill" style={{width: `${device.percentage}%`}}></div>
                                            <span className="percentage-value">{device.percentage}%</span>
                                        </div>
                                    </td>
                                    <td className="cost-cell-premium">
                                        <div className="cost-badge">${device.cost.toFixed(2)}</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
