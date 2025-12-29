import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Dashboard from './components/DashboardNew';
import EnergyMonitor from './components/EnergyMonitor';
import DeviceControl from './components/DeviceControl';
import Analytics from './components/Analytics';
import EfficiencyScore from './components/EfficiencyScore';
import SmartRecommendations from './components/SmartRecommendations';
import MLPredictions from './components/MLPredictions';
import './styles/App.css';

const App = () => {
    return (
        <Router>
            <div className="App">
                <nav className="navbar">
                    <h1>Smart Home Energy Management</h1>
                    <div className="nav-links">
                        <Link to="/">Dashboard</Link>
                        <Link to="/analytics">Analytics</Link>
                        <Link to="/ml-predictions">ML Predictions</Link>
                        <Link to="/efficiency">Efficiency</Link>
                        <Link to="/recommendations">Tips</Link>
                        <Link to="/control">Devices</Link>
                        <a href={`${window.location.protocol}//${window.location.hostname}:1880`} target="_blank" rel="noopener noreferrer" className="external-link">
                            Node-RED 🔗
                        </a>
                        <a href={`${window.location.protocol}//${window.location.hostname}:3001`} target="_blank" rel="noopener noreferrer" className="external-link">
                            Grafana 🔗
                        </a>
                    </div>
                </nav>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/ml-predictions" element={<MLPredictions />} />
                    <Route path="/efficiency" element={<EfficiencyScore />} />
                    <Route path="/recommendations" element={<SmartRecommendations />} />
                    <Route path="/monitor" element={<EnergyMonitor />} />
                    <Route path="/control" element={<DeviceControl />} />
                </Routes>
                <ToastContainer
                    position="top-right"
                    autoClose={3000}
                    hideProgressBar={false}
                    newestOnTop
                    closeOnClick
                    pauseOnHover
                    draggable
                    theme="light"
                />
                <footer className="app-footer">
                    <div className="footer-content">
                        <div className="project-info">
                            <h3>Graduation Project 2025/2026</h3>
                            <p className="student-name">Muhammed Simeysim</p>
                            <p className="university">Toros University</p>
                        </div>
                    </div>
                </footer>
            </div>
        </Router>
    );
};

export default App;