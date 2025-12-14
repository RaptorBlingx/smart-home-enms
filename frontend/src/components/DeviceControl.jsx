import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../styles/DeviceControl.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:8000`;

const DeviceControl = () => {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toggleLoading, setToggleLoading] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');

    useEffect(() => {
        const fetchDevices = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/api/devices`);
                setDevices(response.data);
                setLoading(false);
                setError(null);
            } catch (error) {
                console.error('Error fetching devices:', error);
                setError('Failed to load devices');
                setLoading(false);
                toast.error('❌ Failed to load devices');
            }
        };

        fetchDevices();
        const interval = setInterval(fetchDevices, 10000);
        return () => clearInterval(interval);
    }, []);

  const toggleDevice = async (deviceId) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    // Confirmation for turning off critical appliances
    if (device.type === 'Appliance' && device.status === 'on') {
      const confirmed = window.confirm(
        `⚠️ Are you sure you want to turn off ${device.name}?\n\nThis is a critical appliance.`
      );
      if (!confirmed) return;
    }

    // Set loading state for this device
    setToggleLoading(prev => ({ ...prev, [deviceId]: true }));

    // Optimistic update
    setDevices(prevDevices =>
      prevDevices.map(d =>
        d.id === deviceId ? { ...d, status: d.status === 'on' ? 'off' : 'on' } : d
      )
    );

    try {
      const response = await axios.patch(`http://localhost:8000/api/devices/${deviceId}/toggle`);
      console.log('✅ Device toggled:', response.data);
      
      // Update with server response
      setDevices(prevDevices =>
        prevDevices.map(d =>
          d.id === deviceId ? { ...d, ...response.data } : d
        )
      );
      
      // Show success toast
      const newStatus = response.data.status === 'on' ? 'ON' : 'OFF';
      toast.success(`✅ ${device.name} turned ${newStatus}!`, {
        icon: newStatus === 'ON' ? '🟢' : '🔴'
      });
      
      // Clear loading state
      setToggleLoading(prev => ({ ...prev, [deviceId]: false }));
    } catch (error) {
      console.error('❌ Error toggling device:', error);
      // Revert on error
      setDevices(prevDevices =>
        prevDevices.map(d =>
          d.id === deviceId ? { ...d, status: device.status } : d
        )
      );
      
      // Show error toast
      toast.error(`❌ Failed to toggle ${device.name}`);
      
      // Clear loading state
      setToggleLoading(prev => ({ ...prev, [deviceId]: false }));
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
        return icons[name] || '🔌';
    };

    const getDevicePower = (name) => {
        const powers = {
            'Lights': { current: 45, max: 60, unit: 'W' },
            'Refrigerator': { current: 120, max: 150, unit: 'W' },
            'AC': { current: 1200, max: 1500, unit: 'W' },
            'Washing Machine': { current: 500, max: 800, unit: 'W' },
            'TV': { current: 85, max: 120, unit: 'W' }
        };
        return powers[name] || { current: 0, max: 100, unit: 'W' };
    };

    const filteredDevices = devices.filter(device => {
        const matchesSearch = device.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterType === 'all' || device.type === filterType;
        return matchesSearch && matchesFilter;
    });

    const stats = {
        total: devices.length,
        active: devices.filter(d => d.status === 'on').length,
        inactive: devices.filter(d => d.status === 'off').length,
        totalPower: devices
            .filter(d => d.status === 'on')
            .reduce((sum, d) => sum + getDevicePower(d.name).current, 0)
    };

    if (loading) {
        return (
            <div className="device-control-container">
                <div className="loading-state">
                    <div className="spinner-large"></div>
                    <p>Loading devices...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="device-control-container">
                <div className="error-state">
                    <span className="error-icon">⚠️</span>
                    <h3>Failed to Load Devices</h3>
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()}>Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className="device-control-container">
            {/* Header */}
            <div className="control-header">
                <div className="header-content">
                    <h1>Device Control Center</h1>
                    <p className="subtitle">Manage and monitor all your smart home devices</p>
                </div>
                <div className="header-stats">
                    <div className="mini-stat">
                        <span className="mini-stat-value">{stats.total}</span>
                        <span className="mini-stat-label">Total Devices</span>
                    </div>
                    <div className="mini-stat active">
                        <span className="mini-stat-value">{stats.active}</span>
                        <span className="mini-stat-label">Active Now</span>
                    </div>
                    <div className="mini-stat power">
                        <span className="mini-stat-value">{(stats.totalPower / 1000).toFixed(2)}</span>
                        <span className="mini-stat-label">kW Power</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="control-filters">
                <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Search devices..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filter-buttons">
                    <button 
                        className={filterType === 'all' ? 'active' : ''}
                        onClick={() => setFilterType('all')}
                    >
                        All ({devices.length})
                    </button>
                    <button 
                        className={filterType === 'Appliance' ? 'active' : ''}
                        onClick={() => setFilterType('Appliance')}
                    >
                        Appliances ({devices.filter(d => d.type === 'Appliance').length})
                    </button>
                    <button 
                        className={filterType === 'Light' ? 'active' : ''}
                        onClick={() => setFilterType('Light')}
                    >
                        Lights ({devices.filter(d => d.type === 'Light').length})
                    </button>
                    <button 
                        className={filterType === 'Entertainment' ? 'active' : ''}
                        onClick={() => setFilterType('Entertainment')}
                    >
                        Entertainment ({devices.filter(d => d.type === 'Entertainment').length})
                    </button>
                </div>
            </div>

            {/* Device Grid */}
            <div className="premium-device-grid">
                {filteredDevices.map(device => {
                    const power = getDevicePower(device.name);
                    const powerPercentage = (power.current / power.max) * 100;
                    
                    return (
                        <div key={device.id} className={`premium-device-card ${device.status}`}>
                            <div className="device-card-header">
                                <div className="device-icon-wrapper">
                                    <span className="device-icon-large">{getDeviceIcon(device.name, device.type)}</span>
                                    <div className={`status-pulse ${device.status}`}></div>
                                </div>
                                <div className="device-info">
                                    <h3>{device.name}</h3>
                                    <span className="device-type">{device.type}</span>
                                </div>
                            </div>

                            <div className="device-status-badge">
                                <span className={`status-dot ${device.status}`}></span>
                                <span className="status-text">{device.status === 'on' ? 'Active' : 'Inactive'}</span>
                            </div>

                            {device.status === 'on' && (
                                <div className="power-consumption">
                                    <div className="power-label">
                                        <span>Power Draw</span>
                                        <span className="power-value">{power.current}{power.unit}</span>
                                    </div>
                                    <div className="power-bar">
                                        <div 
                                            className="power-fill" 
                                            style={{ width: `${powerPercentage}%` }}
                                        ></div>
                                    </div>
                                    <div className="power-info">
                                        <span>{powerPercentage.toFixed(0)}% of max</span>
                                        <span>{power.max}{power.unit}</span>
                                    </div>
                                </div>
                            )}

                            <button 
                                className={`premium-toggle-btn ${device.status} ${toggleLoading[device.id] ? 'loading' : ''}`}
                                onClick={() => toggleDevice(device.id)}
                                disabled={toggleLoading[device.id]}
                            >
                                {toggleLoading[device.id] ? (
                                    <>
                                        <span className="btn-spinner"></span>
                                        <span>Processing...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="btn-icon">{device.status === 'on' ? '⏸' : '▶'}</span>
                                        <span>Turn {device.status === 'on' ? 'Off' : 'On'}</span>
                                    </>
                                )}
                            </button>

                            {device.status === 'on' && (
                                <div className="device-footer">
                                    <span className="footer-info">⚡ Running efficiently</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {filteredDevices.length === 0 && (
                <div className="no-results">
                    <span className="no-results-icon">🔍</span>
                    <h3>No devices found</h3>
                    <p>Try adjusting your search or filter criteria</p>
                </div>
            )}
        </div>
    );
};

export default DeviceControl;