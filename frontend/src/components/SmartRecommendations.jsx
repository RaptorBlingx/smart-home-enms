import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../styles/SmartRecommendations_Premium.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;

const SmartRecommendations = () => {
    const [recommendations, setRecommendations] = useState([]);
    const [peakHours, setPeakHours] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dismissedIds, setDismissedIds] = useState([]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60000); // Refresh every minute
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const [recsResponse, peakResponse] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/recommendations`),
                axios.get(`${API_BASE_URL}/api/energy/peak-hours?days=7`)
            ]);
            
            setRecommendations(recsResponse.data.recommendations || []);
            setPeakHours(peakResponse.data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching recommendations:', err);
            toast.error('Failed to load recommendations');
            setLoading(false);
        }
    };

    const getPriorityColor = (priority) => {
        const colors = {
            'high': '#EF4444',
            'medium': '#F59E0B',
            'low': '#10B981'
        };
        return colors[priority] || '#6B7280';
    };

    const getPriorityIcon = (priority) => {
        const icons = {
            'high': '🔴',
            'medium': '🟡',
            'low': '🟢'
        };
        return icons[priority] || '📊';
    };

    const dismissRecommendation = (id) => {
        setDismissedIds([...dismissedIds, id]);
        toast.info('Recommendation dismissed');
    };

    const visibleRecommendations = recommendations.filter(rec => !dismissedIds.includes(rec.id));

    if (loading) {
        return (
            <div className="recommendations-container">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Loading recommendations...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="recommendations-container-premium">
            {/* Premium Hero Section */}
            <div className="recommendations-hero">
                <div className="hero-content">
                    <h1 className="hero-title">💡 Smart Recommendations</h1>
                    <p className="hero-subtitle">AI-powered insights to optimize your energy usage</p>
                </div>
                <div className="hero-stats">
                    <div className="hero-stat">
                        <span className="stat-number">{visibleRecommendations.length}</span>
                        <span className="stat-label">Active Tips</span>
                    </div>
                    <div className="hero-stat">
                        <span className="stat-number">
                            {peakHours ? `$${peakHours.potential_savings_monthly.toFixed(0)}` : '$0'}
                        </span>
                        <span className="stat-label">Est. Savings</span>
                    </div>
                </div>
            </div>

            {/* Premium Peak Hours Cards */}
            {peakHours && (
                <div className="peak-hours-grid">
                    <div className="peak-card peak-card-danger">
                        <div className="peak-card-icon">⚡</div>
                        <div className="peak-card-content">
                            <h3 className="peak-card-title">Peak Hours</h3>
                            <div className="peak-hours-list">
                                {peakHours.peak_hours.slice(0, 3).map((h, idx) => (
                                    <span key={idx} className="hour-badge hour-badge-red">{h}:00</span>
                                ))}
                                {peakHours.peak_hours.length > 3 && (
                                    <span className="hour-more">+{peakHours.peak_hours.length - 3} more</span>
                                )}
                            </div>
                            <p className="peak-card-desc">Avoid high consumption periods</p>
                            <div className="peak-progress">
                                <div className="peak-progress-bar peak-bar-red" style={{ width: '85%' }}></div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="peak-card peak-card-success">
                        <div className="peak-card-icon">🌙</div>
                        <div className="peak-card-content">
                            <h3 className="peak-card-title">Off-Peak Hours</h3>
                            <div className="peak-hours-list">
                                {peakHours.off_peak_hours.slice(0, 3).map((h, idx) => (
                                    <span key={idx} className="hour-badge hour-badge-green">{h}:00</span>
                                ))}
                                {peakHours.off_peak_hours.length > 3 && (
                                    <span className="hour-more">+{peakHours.off_peak_hours.length - 3} more</span>
                                )}
                            </div>
                            <p className="peak-card-desc">Optimal usage windows</p>
                            <div className="peak-progress">
                                <div className="peak-progress-bar peak-bar-green" style={{ width: '45%' }}></div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="peak-card peak-card-info">
                        <div className="peak-card-icon">💰</div>
                        <div className="peak-card-content">
                            <h3 className="peak-card-title">Monthly Savings</h3>
                            <div className="savings-amount">
                                <span className="amount-value">${peakHours.potential_savings_monthly.toFixed(2)}</span>
                                <span className="amount-period">/month</span>
                            </div>
                            <p className="peak-card-desc">By shifting to off-peak</p>
                            <div className="peak-progress">
                                <div className="peak-progress-bar peak-bar-blue" style={{ width: '65%' }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Premium Recommendations Section */}
            {visibleRecommendations.length === 0 ? (
                <div className="no-recommendations-premium">
                    <div className="no-rec-icon-wrapper">
                        <span className="no-rec-icon">🌟</span>
                    </div>
                    <h3>Excellent Performance!</h3>
                    <p>No urgent recommendations at this time.</p>
                    <p className="no-rec-detail">Keep up the efficient energy usage!</p>
                </div>
            ) : (
                <div className="recommendations-section">
                    <div className="section-header">
                        <h3>🎯 Priority Actions</h3>
                        <span className="rec-count">{visibleRecommendations.length} recommendations</span>
                    </div>
                    <div className="recommendations-grid">
                        {visibleRecommendations.map((rec, index) => (
                            <div 
                                key={rec.id} 
                                className={`recommendation-card-premium priority-${rec.priority}`}
                                style={{ animationDelay: `${index * 0.1}s` }}
                            >
                                <button 
                                    className="dismiss-btn-premium"
                                    onClick={() => dismissRecommendation(rec.id)}
                                    title="Dismiss"
                                >
                                    ✕
                                </button>
                                
                                <div className="rec-card-header">
                                    <div className="rec-icon-wrapper" style={{ backgroundColor: getPriorityColor(rec.priority) }}>
                                        <span className="rec-icon-emoji">{getPriorityIcon(rec.priority)}</span>
                                    </div>
                                    <div className="rec-header-content">
                                        <div className="rec-priority-badge" style={{ backgroundColor: getPriorityColor(rec.priority) }}>
                                            {rec.priority.toUpperCase()}
                                        </div>
                                        <h4 className="rec-title-premium">{rec.title}</h4>
                                    </div>
                                </div>
                                
                                <div className="rec-device-badge">
                                    <span className="device-icon">🔌</span>
                                    <span className="device-name">{rec.device}</span>
                                </div>
                                
                                <p className="rec-message-premium">{rec.message}</p>
                                
                                <div className="rec-action-box">
                                    <div className="action-icon">⚙️</div>
                                    <div className="action-text">
                                        <strong>Recommended Action</strong>
                                        <p>{rec.action}</p>
                                    </div>
                                </div>
                                
                                <div className="rec-footer-premium">
                                    <div className="rec-savings-premium">
                                        <span className="savings-icon">💵</span>
                                        <span className="savings-text">{rec.savings}</span>
                                    </div>
                                    <div className="rec-impact-badge" style={{ borderColor: getPriorityColor(rec.priority), color: getPriorityColor(rec.priority) }}>
                                        {rec.impact}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Premium Heat Map */}
            {peakHours && peakHours.hourly_avg && (
                <div className="heatmap-section-premium">
                    <div className="section-header">
                        <h3>📈 24-Hour Consumption Pattern</h3>
                        <div className="heatmap-legend-inline">
                            <span className="legend-label">Low</span>
                            <div className="legend-bar-inline"></div>
                            <span className="legend-label">High</span>
                        </div>
                    </div>
                    
                    <div className="heatmap-premium">
                        {Object.entries(peakHours.hourly_avg).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([hour, avg]) => {
                            const maxAvg = Math.max(...Object.values(peakHours.hourly_avg));
                            const minAvg = Math.min(...Object.values(peakHours.hourly_avg));
                            const intensity = ((avg - minAvg) / (maxAvg - minAvg)) * 100;
                            let color, borderColor;
                            if (intensity > 80) {
                                color = '#FEE2E2';
                                borderColor = '#EF4444';
                            } else if (intensity > 60) {
                                color = '#FED7AA';
                                borderColor = '#F59E0B';
                            } else if (intensity > 40) {
                                color = '#FEF3C7';
                                borderColor = '#FBBF24';
                            } else if (intensity > 20) {
                                color = '#D1FAE5';
                                borderColor = '#10B981';
                            } else {
                                color = '#A7F3D0';
                                borderColor = '#059669';
                            }
                            
                            const isPeak = peakHours.peak_hours.includes(parseInt(hour));
                            const isOffPeak = peakHours.off_peak_hours.includes(parseInt(hour));
                            
                            return (
                                <div 
                                    key={hour} 
                                    className={`heatmap-cell-premium ${
                                        isPeak ? 'cell-peak' : isOffPeak ? 'cell-offpeak' : ''
                                    }`}
                                    style={{ 
                                        backgroundColor: color,
                                        borderColor: borderColor
                                    }}
                                    title={`${hour}:00 - ${avg.toFixed(2)} kW${isPeak ? ' (Peak)' : isOffPeak ? ' (Off-Peak)' : ''}`}
                                >
                                    <div className="heatmap-hour-premium">{hour}:00</div>
                                    <div className="heatmap-value-premium">{avg.toFixed(1)} kW</div>
                                    {isPeak && <div className="peak-indicator">⚡</div>}
                                    {isOffPeak && <div className="offpeak-indicator">🌙</div>}
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="heatmap-insights">
                        <div className="insight-item">
                            <span className="insight-icon">⚡</span>
                            <span className="insight-text">Peak: {peakHours.peak_hours.length} hours</span>
                        </div>
                        <div className="insight-item">
                            <span className="insight-icon">🌙</span>
                            <span className="insight-text">Off-Peak: {peakHours.off_peak_hours.length} hours</span>
                        </div>
                        <div className="insight-item">
                            <span className="insight-icon">📊</span>
                            <span className="insight-text">
                                Avg: {(Object.values(peakHours.hourly_avg).reduce((a, b) => a + b, 0) / Object.values(peakHours.hourly_avg).length).toFixed(2)} kW
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SmartRecommendations;
