import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/EfficiencyScore_Premium.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;

const EfficiencyScore = () => {
    const [scoreData, setScoreData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchEfficiencyScore();
        const interval = setInterval(fetchEfficiencyScore, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const fetchEfficiencyScore = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/efficiency/score?days=7`);
            setScoreData(response.data);
            setLoading(false);
            setError(null);
        } catch (err) {
            console.error('Error fetching efficiency score:', err);
            setError('Failed to load efficiency score');
            setLoading(false);
        }
    };

    const getGradeColor = (grade) => {
        const colors = {
            'A+': '#10B981',
            'A': '#34D399',
            'B': '#FBBF24',
            'C': '#F59E0B',
            'D': '#EF4444',
            'F': '#DC2626'
        };
        return colors[grade] || '#9CA3AF';
    };

    const getGradeEmoji = (grade) => {
        const emojis = {
            'A+': '🌟',
            'A': '✨',
            'B': '👍',
            'C': '⚠️',
            'D': '📉',
            'F': '🔴'
        };
        return emojis[grade] || '📊';
    };

    if (loading) {
        return (
            <div className="efficiency-container">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Loading efficiency score...</p>
                </div>
            </div>
        );
    }

    if (error || !scoreData) {
        return (
            <div className="efficiency-container">
                <div className="error-message">{error || 'No data available'}</div>
            </div>
        );
    }

    return (
        <div className="efficiency-container-premium">
            {/* Premium Hero Section */}
            <div className="efficiency-hero">
                <div className="hero-content">
                    <h1 className="hero-title">Energy Efficiency Score</h1>
                    <p className="hero-subtitle">Real-time performance analysis</p>
                </div>
                <div className="hero-badge">
                    <span className="badge-dot"></span>
                    <span className="badge-text">Live</span>
                </div>
            </div>
            
            {/* Premium Score Circle with Animation */}
            <div className="score-main-section">
                <div className="score-circle-container-premium">
                    <svg className="score-circle-svg" viewBox="0 0 200 200">
                        <circle 
                            className="score-circle-bg" 
                            cx="100" 
                            cy="100" 
                            r="90"
                        />
                        <circle 
                            className="score-circle-progress" 
                            cx="100" 
                            cy="100" 
                            r="90"
                            style={{
                                stroke: getGradeColor(scoreData.grade),
                                strokeDashoffset: 565.48 - (565.48 * scoreData.score / 100)
                            }}
                        />
                    </svg>
                    <div className="score-inner-content">
                        <div className="score-value-large">{scoreData.score}</div>
                        <div className="score-label-small">Efficiency</div>
                        <div 
                            className="grade-badge-inline" 
                            style={{ backgroundColor: getGradeColor(scoreData.grade) }}
                        >
                            <span className="grade-emoji-small">{getGradeEmoji(scoreData.grade)}</span>
                            <span className="grade-text-small">{scoreData.grade}</span>
                        </div>
                    </div>
                </div>
                
                {/* Quick Stats */}
                <div className="quick-stats-grid">
                    <div className="stat-card stat-card-green">
                        <div className="stat-icon">⚡</div>
                        <div className="stat-content">
                            <div className="stat-value">{scoreData.avg_daily_consumption}</div>
                            <div className="stat-label">kWh/day</div>
                        </div>
                    </div>
                    <div className="stat-card stat-card-blue">
                        <div className="stat-icon">📊</div>
                        <div className="stat-content">
                            <div className="stat-value">{scoreData.benchmark_consumption}</div>
                            <div className="stat-label">Benchmark</div>
                        </div>
                    </div>
                    <div className="stat-card stat-card-yellow">
                        <div className="stat-icon">💰</div>
                        <div className="stat-content">
                            <div className="stat-value">
                                {scoreData.avg_daily_consumption > scoreData.benchmark_consumption 
                                    ? '+' + ((scoreData.avg_daily_consumption - scoreData.benchmark_consumption) * 0.12).toFixed(1)
                                    : '-' + ((scoreData.benchmark_consumption - scoreData.avg_daily_consumption) * 0.12).toFixed(1)
                                }
                            </div>
                            <div className="stat-label">$/day</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Comparison Card */}
            <div className="comparison-card-premium">
                <div className="comparison-header">
                    <h3>Performance Analysis</h3>
                    <span className="comparison-badge">{scoreData.comparison}</span>
                </div>
                <div className="comparison-details">
                    <div className="comparison-metric">
                        <span className="metric-label">Your Usage</span>
                        <div className="metric-bar">
                            <div 
                                className="metric-fill metric-fill-user"
                                style={{ width: `${(scoreData.avg_daily_consumption / scoreData.benchmark_consumption) * 100}%` }}
                            ></div>
                        </div>
                        <span className="metric-value">{scoreData.avg_daily_consumption} kWh/day</span>
                    </div>
                    <div className="comparison-metric">
                        <span className="metric-label">Average Benchmark</span>
                        <div className="metric-bar">
                            <div className="metric-fill metric-fill-benchmark" style={{ width: '100%' }}></div>
                        </div>
                        <span className="metric-value">{scoreData.benchmark_consumption} kWh/day</span>
                    </div>
                </div>
            </div>

            {/* Historical Trend Chart */}
            {scoreData.historical_scores && scoreData.historical_scores.length > 0 && (
                <div className="trend-section-premium">
                    <div className="section-header">
                        <h3>📈 7-Day Performance Trend</h3>
                        <span className="trend-insight">
                            {scoreData.historical_scores[scoreData.historical_scores.length - 1].score > 
                             scoreData.historical_scores[0].score ? '↗️ Improving' : '↘️ Declining'}
                        </span>
                    </div>
                    <div className="trend-chart-premium">
                        {scoreData.historical_scores.map((day, index) => (
                            <div key={index} className="trend-item">
                                <div className="trend-bar-wrapper">
                                    <div 
                                        className="trend-bar-premium" 
                                        style={{ 
                                            height: `${day.score}%`,
                                            backgroundColor: day.score >= 85 ? '#10B981' : day.score >= 70 ? '#FBBF24' : '#EF4444'
                                        }}
                                    >
                                        <span className="trend-value">{day.score}</span>
                                    </div>
                                </div>
                                <div className="trend-date">{day.date.substring(5)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Premium Tips Section */}
            <div className="insights-section-premium">
                <div className="section-header">
                    <h3>💡 Personalized Recommendations</h3>
                    <span className="insights-count">{scoreData.tips ? scoreData.tips.length : 0} actions</span>
                </div>
                <div className="insights-grid">
                    {scoreData.tips && scoreData.tips.map((tip, index) => (
                        <div key={index} className="insight-card">
                            <div className="insight-icon-wrapper">
                                <span className="insight-icon">
                                    {index === 0 ? '🔌' : index === 1 ? '🌡️' : index === 2 ? '💡' : '⚙️'}
                                </span>
                            </div>
                            <div className="insight-content">
                                <p className="insight-text">{tip}</p>
                            </div>
                            <div className="insight-priority">
                                <span className="priority-badge priority-high">High Priority</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default EfficiencyScore;
