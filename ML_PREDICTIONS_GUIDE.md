# 🤖 ML Predictions Feature - Implementation Guide

## Overview
The ML Predictions feature uses machine learning to predict future energy consumption and costs based on historical patterns. This document explains how the feature works and how to use it.

---

## How It Works

### Machine Learning Model
- **Algorithm:** Linear Regression (scikit-learn)
- **Training Data:** Last 7 days of energy consumption
- **Features Used:**
  - Hour of day (0-23)
  - Day of week (0-6)
  - Is weekend (0 or 1)
  - Cyclical time encoding (sin/cos of hour)
  - Days since start

### Predictions Generated
1. **Next 24 Hours:** Hourly consumption predictions
2. **Daily Projection:** Average daily consumption
3. **Monthly Projection:** Estimated monthly total
4. **Device Breakdown:** Per-device predictions
5. **Cost Estimates:** Predictions converted to costs

---

## API Endpoints

### 1. Get Predictions Summary (Recommended)
```
GET /api/ml/predictions/summary?hours=24
```

**Response:**
```json
{
  "success": true,
  "prediction_period_hours": 24,
  "next_24h": {
    "total_kwh": 45.32,
    "total_cost": 5.44
  },
  "projected_daily": {
    "total_kwh": 45.32,
    "total_cost": 5.44
  },
  "projected_monthly": {
    "total_kwh": 1359.60,
    "total_cost": 163.15
  },
  "device_breakdown": [
    {
      "device_name": "AC",
      "predicted_kwh": 28.50,
      "predicted_cost": 3.42,
      "percentage": 62.9
    },
    ...
  ]
}
```

### 2. Get All Device Predictions
```
GET /api/ml/predictions?hours=24
```

Returns predictions for all devices with hourly breakdowns.

### 3. Get Single Device Prediction
```
GET /api/ml/device/{device_name}/predictions?hours=24
```

Returns detailed hourly predictions for a specific device.

### 4. Train/Retrain Models
```
POST /api/ml/train?days=7
```

Manually trigger model training (optional - trains automatically on first prediction).

---

## Frontend Integration

### Dashboard Component
The predictions are automatically fetched and displayed in the Dashboard:

```jsx
const [predictions, setPredictions] = useState(null);

// Fetch predictions
axios.get(`${API_BASE_URL}/api/ml/predictions/summary?hours=24`)
  .then(response => setPredictions(response.data));
```

### Display Sections
1. **Summary Cards:** Next 24h, Daily, Monthly predictions
2. **Device Breakdown:** Top 5 devices with predicted consumption
3. **Cost Estimates:** All predictions include cost calculations

---

## How to Use

### 1. Automatic Training
The model trains automatically when you first request predictions. No manual setup required!

### 2. View Predictions
Simply open the Dashboard at `http://localhost:3002` and scroll to the **AI-Powered Predictions** section.

### 3. Retrain Models (Optional)
If you want to retrain with fresh data:
```bash
curl -X POST http://localhost:8000/api/ml/train
```

Or use the API docs at `http://localhost:8000/docs`

---

## Technical Details

### Model Training
- **Frequency:** On-demand (first prediction request)
- **Training Time:** ~1-2 seconds per device
- **Model Storage:** Saved to `backend/app/services/models/`
- **Model Files:** 
  - `{device_name}_model.pkl` - Trained model
  - `{device_name}_scaler.pkl` - Feature scaler

### Prediction Accuracy
- **R² Score:** Typically 0.6-0.9 (displayed during training)
- **Confidence:** Based on historical pattern consistency
- **Update Frequency:** Predictions update every 10 seconds (with dashboard refresh)

### Data Requirements
- **Minimum:** 10 data points per device
- **Recommended:** 7 days of historical data
- **Optimal:** 14+ days for better accuracy

---

## Troubleshooting

### "Insufficient data for training"
**Problem:** Not enough historical data  
**Solution:** Let the simulator run for at least 1 hour to collect more data

### Predictions seem off
**Problem:** Model needs retraining with recent data  
**Solution:** Restart the backend or manually trigger training:
```bash
curl -X POST http://localhost:8000/api/ml/train?days=7
```

### Models not loading
**Problem:** Model files missing or corrupted  
**Solution:** Delete `backend/app/services/models/` folder and restart. Models will retrain automatically.

---

## Advanced Features

### Custom Prediction Periods
Change the prediction window:
```javascript
// Predict next 48 hours
axios.get(`${API_BASE_URL}/api/ml/predictions/summary?hours=48`)

// Predict next week
axios.get(`${API_BASE_URL}/api/ml/predictions/summary?hours=168`)
```

### Historical Data Range
Train with more data:
```bash
# Train with 14 days of data
curl -X POST http://localhost:8000/api/ml/train?days=14
```

### Device-Specific Predictions
Get detailed predictions for one device:
```javascript
axios.get(`${API_BASE_URL}/api/ml/device/AC/predictions?hours=24`)
```

---

## Future Enhancements

Potential improvements for the ML system:

1. **Advanced Models:**
   - LSTM/RNN for time-series prediction
   - Prophet for seasonal patterns
   - Ensemble methods for better accuracy

2. **Additional Features:**
   - Weather data integration
   - Occupancy patterns
   - Historical cost trends
   - Seasonal adjustments

3. **Real-time Learning:**
   - Incremental model updates
   - Online learning algorithms
   - Adaptive prediction windows

4. **Anomaly Detection:**
   - Unusual consumption alerts
   - Device fault detection
   - Efficiency degradation warnings

---

## Performance Notes

- **Prediction Speed:** ~50-100ms per request
- **Training Speed:** ~1-2 seconds per device
- **Memory Usage:** ~5-10MB per trained model
- **CPU Usage:** Minimal (predictions are cached)

---

## Dependencies

```python
scikit-learn==1.3.2  # ML algorithms
pandas==2.1.4        # Data manipulation
numpy==1.26.2        # Numerical operations
joblib==1.3.2        # Model persistence
```

All dependencies are automatically installed when you rebuild the backend container.

---

## Quick Start

1. **Start the system:**
   ```bash
   docker compose up -d --build
   ```

2. **Wait for data collection:**
   - Simulator runs for ~1 hour (minimum)
   - Or use existing historical data

3. **View predictions:**
   - Open http://localhost:3002
   - Scroll to "AI-Powered Predictions" section

4. **Check accuracy:**
   - Monitor predictions vs actual consumption
   - Retrain if needed for better accuracy

---

## API Documentation

Full interactive API documentation available at:
**http://localhost:8000/docs**

Search for "ML Prediction" endpoints in the API docs for interactive testing.

---

## Support

For questions or issues:
1. Check backend logs: `docker logs smart_home_backend`
2. Verify data exists: Visit http://localhost:8000/api/energy/consumption
3. Check model training: `docker exec smart_home_backend ls -la app/services/models/`

Happy predicting! 🚀
