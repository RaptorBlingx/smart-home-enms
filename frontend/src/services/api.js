import axios from 'axios';

// Use relative URL for API calls - proxied through nginx
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

export const getEnergyData = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/energy`);
        return response.data;
    } catch (error) {
        console.error('Error fetching energy data:', error);
        throw error;
    }
};

export const controlDevice = async (deviceId, action) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/api/devices/${deviceId}/control`, { action });
        return response.data;
    } catch (error) {
        console.error('Error controlling device:', error);
        throw error;
    }
};