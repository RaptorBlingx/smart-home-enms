# Machine Learning Implementation Guide

## Overview
The Smart Home Energy Management System includes a **fully implemented Machine Learning prediction engine** using scikit-learn's Linear Regression with advanced feature engineering.

## Features Implemented ✅

### 1. **ML Service** (`backend/app/services/ml_service.py`)
- **Linear Regression Models** - One model per device
- **Feature Engineering**:
  - Hour of day (0-23)
  - Day of week (0-6, Monday=0)
  - Is weekend (binary)
  - Cyclical hour encoding (sin/cos transformation)
  - Days since training start
- **Model Persistence** - Models saved to `app/services/models/`
- **Fallback Strategy** - Uses simple hourly averages when R² < 0.1
- **Training Requirements** - Minimum 7 days of historical data

### 2. **API Endpoints**

#### Get Predictions
```bash
# All devices (next 24 hours)
GET /api/ml/predictions?hours=24

# Specific device
GET /api/ml/predictions?device=washing_machine&hours=24

# Detailed device predictions
GET /api/ml/device/{device_name}/predictions?hours=24
```

#### Get Summary with Cost Projections
```bash
GET /api/ml/predictions/summary?hours=24
```

Returns:
- Next 24h prediction (kWh and cost)
- Daily projection
- Monthly projection
- Device-by-device breakdown with percentages

#### Train Models
```bash
# Train all devices
POST /api/ml/train

# Train specific device with custom history
POST /api/ml/train?device=refrigerator&days=14
```

### 3. **Frontend ML Predictions Page** 🆕

Navigate to: **http://localhost:3002/ml-predictions**

Features:
- 📊 **Interactive Charts** - Visual prediction timeline
- 🎛️ **Device Selection** - View all devices or specific ones
- ⏱️ **Flexible Timeframes** - 6h, 12h, 24h, 48h predictions
- 💰 **Cost Projections** - Daily and monthly estimates
- 📈 **Device Breakdown** - See which devices consume most
- 🧠 **One-Click Training** - Train models directly from UI

## How to Use

### Step 1: Generate Historical Data
Your simulator needs to run for at least **7 days** to collect enough training data.

Quick test (simulate 7 days of data):
```bash
# Modify simulator to generate backdated data or wait 7 days
# Or use the existing data if system has been running
```

### Step 2: Train Models

**Via API:**
```bash
curl -X POST http://localhost:8000/api/ml/train
```

**Via Frontend:**
1. Go to http://localhost:3002/ml-predictions
2. Click "🧠 Train Models" button
3. Wait for training to complete (~10-30 seconds per device)

### Step 3: View Predictions

**Via API:**
```bash
# Get summary
curl http://localhost:8000/api/ml/predictions/summary?hours=24

# Get specific device
curl http://localhost:8000/api/ml/device/washing_machine/predictions?hours=24
```

**Via Frontend:**
1. Navigate to "ML Predictions" in the top menu
2. Select device or "All Devices"
3. Choose prediction period
4. View charts and breakdown

## Model Performance Metrics

The system calculates and stores:
- **R² Score** - Coefficient of determination (higher = better fit)
- **MAE** - Mean Absolute Error
- **RMSE** - Root Mean Squared Error

Access via:
```bash
GET /api/ml/models  # List all trained models with metrics
```

## Example Response

```json
{
  "success": true,
  "prediction_period_hours": 24,
  "next_24h": {
    "total_kwh": 45.32,
    "total_cost": 5.44
  },
  "projected_monthly": {
    "total_kwh": 1359.6,
    "total_cost": 163.15
  },
  "device_breakdown": [
    {
      "device_name": "air_conditioner",
      "predicted_kwh": 18.45,
      "predicted_cost": 2.21,
      "percentage": 40.7
    },
    {
      "device_name": "water_heater",
      "predicted_kwh": 12.34,
      "predicted_cost": 1.48,
      "percentage": 27.2
    }
  ]
}
```

## Technical Details

### Feature Cyclical Encoding
Hours are encoded as sin/cos to capture cyclical patterns:
```python
hour_sin = sin(2π × hour / 24)
hour_cos = cos(2π × hour / 24)
```

This ensures the model understands that 23:00 and 00:00 are close.

### Model Training Process
1. Fetch 7 days of historical readings from PostgreSQL
2. Extract features (hour, day, weekend, cyclical encoding)
3. Standardize features using StandardScaler
4. Train Linear Regression model
5. Calculate R² score on training data
6. If R² < 0.1, flag for simple averaging fallback
7. Save model, scaler, and metadata to disk
8. Store metrics in database

### Prediction Process
1. Load trained model (or train if not exists)
2. Generate future timestamps (next N hours)
3. Extract same features for future times
4. Apply same StandardScaler transformation
5. Use model to predict or fallback to hourly averages
6. Ensure predictions are non-negative and reasonable
7. Return hourly breakdown with totals

## Troubleshooting

### "Insufficient data for training"
- Need at least 10 data points (preferably 7 days)
- Check: `SELECT COUNT(*) FROM energy_consumption WHERE device_name = 'your_device'`

### Low R² scores
- Normal for devices with irregular patterns
- System automatically uses hourly averaging fallback
- Collect more data for better accuracy

### Predictions too high/low
- Check electricity rate configuration
- Verify device simulation parameters
- Retrain with more recent data

### Model not found
- Train models first using POST /api/ml/train
- Check `backend/app/services/models/` directory exists
- Verify database connection

## Future Enhancements (Recommended)

1. **LSTM Neural Networks** - Better for time-series with long-term dependencies
2. **Anomaly Detection** - Identify unusual consumption patterns
3. **Weather Integration** - Include temperature/humidity for AC/heater predictions
4. **User Behavior Learning** - Adapt to household patterns
5. **Reinforcement Learning** - Optimize device scheduling for cost savings
6. **Prophet** - Facebook's forecasting library for seasonal patterns
7. **Model Versioning** - Track model improvements over time
8. **A/B Testing** - Compare different algorithms

## Files Added/Modified

**New Files:**
- `frontend/src/components/MLPredictions.jsx` - ML predictions page component
- `frontend/src/styles/MLPredictions.css` - Styling for predictions page
- `ML_IMPLEMENTATION.md` - This documentation

**Modified Files:**
- `frontend/src/App.jsx` - Added ML Predictions route

**Existing ML Files:**
- `backend/app/services/ml_service.py` - Core ML service (already complete)
- `backend/app/api/routes.py` - ML API endpoints (lines 411-520)

## Summary

✅ **ML is fully implemented in the backend**  
✅ **API endpoints are working and tested**  
✅ **Frontend visualization now added**  
✅ **One-click training from UI**  
✅ **Beautiful charts and cost projections**  
✅ **Device-by-device breakdown**  
✅ **Flexible prediction periods**  

The ML system is **production-ready** and can be extended with more sophisticated algorithms!
