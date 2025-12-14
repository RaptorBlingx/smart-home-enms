# 🧪 ML Predictions - Testing Guide

## Quick Test Steps

### 1. Rebuild and Start Containers
```bash
# Rebuild backend with new ML dependencies
docker compose build backend

# Start all services
docker compose up -d

# Check backend logs
docker logs -f smart_home_backend
```

You should see:
```
✅ Connected to MQTT broker
✅ Backend MQTT client connected successfully
```

### 2. Wait for Data Collection
The ML model needs historical data to train. Options:

**Option A: Use Existing Data (Recommended)**
If you already have data in the database, you're ready to go!

**Option B: Collect New Data**
Wait at least 30-60 minutes for the simulator to generate enough data points.

### 3. Test API Endpoints

#### Check if data exists:
```bash
curl http://localhost:8000/api/energy/consumption | head -20
```

#### Train models manually (optional):
```bash
curl -X POST http://localhost:8000/api/ml/train
```

Expected response:
```json
{
  "success": true,
  "total_devices": 5,
  "successful": 5,
  "failed": 0,
  "results": [
    {
      "success": true,
      "device_name": "AC",
      "r2_score": 0.8542,
      "training_samples": 287,
      "message": "Model trained successfully with 287 samples"
    },
    ...
  ]
}
```

#### Get predictions summary:
```bash
curl http://localhost:8000/api/ml/predictions/summary?hours=24
```

Expected response:
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
  "device_breakdown": [...]
}
```

#### Get predictions for specific device:
```bash
curl http://localhost:8000/api/ml/device/AC/predictions?hours=24
```

### 4. Test Frontend Display

1. Open http://localhost:3002
2. Wait for dashboard to load (10 seconds max)
3. Scroll down to find **"🤖 AI-Powered Predictions"** section
4. You should see:
   - Next 24 Hours prediction
   - Projected Daily consumption
   - Projected Monthly cost
   - Device breakdown with bars

### 5. Verify Predictions Update

1. Wait 10 seconds
2. Dashboard should auto-refresh
3. Predictions may change slightly as new data arrives

---

## Troubleshooting

### Issue: "Insufficient data for training"

**Check data count:**
```bash
docker exec smart_home_postgres psql -U user -d smart_home -c "SELECT device_name, COUNT(*) FROM energy_consumption GROUP BY device_name;"
```

**Expected:** At least 10 rows per device

**Solution:** 
- Wait longer for data collection
- Or manually insert more historical data using the init.sql

### Issue: Backend won't start after rebuild

**Check logs:**
```bash
docker logs smart_home_backend
```

**Common causes:**
- Missing dependencies: Rebuild with `--no-cache`
- Port conflict: Check if 8000 is in use
- Database connection: Verify postgres is healthy

**Solution:**
```bash
docker compose down
docker compose build --no-cache backend
docker compose up -d
```

### Issue: Predictions not showing in frontend

**Check API response:**
```bash
curl http://localhost:8000/api/ml/predictions/summary?hours=24
```

**If API works but frontend doesn't:**
- Check browser console for errors (F12)
- Verify frontend can reach backend
- Check CORS settings

**Solution:**
```bash
docker logs smart_home_frontend
docker compose restart frontend
```

### Issue: Low prediction accuracy (R² score < 0.5)

**Reasons:**
- Not enough training data
- Devices have inconsistent patterns
- Data is too noisy

**Solution:**
```bash
# Retrain with more data
curl -X POST http://localhost:8000/api/ml/train?days=14
```

---

## Performance Verification

### 1. Check Model Files
```bash
docker exec smart_home_backend ls -la app/services/models/
```

You should see files like:
```
AC_model.pkl
AC_scaler.pkl
Refrigerator_model.pkl
Refrigeator_scaler.pkl
...
```

### 2. Benchmark Prediction Speed
```bash
time curl http://localhost:8000/api/ml/predictions/summary?hours=24
```

Expected: < 200ms

### 3. Check Training Time
Look at backend logs when training:
```
INFO: Training model for AC...
INFO: Model trained for AC with R² score: 0.8542
```

Expected: 1-2 seconds per device

---

## Testing Checklist

- [ ] Backend starts without errors
- [ ] ML dependencies installed (scikit-learn, pandas)
- [ ] Historical data exists (10+ points per device)
- [ ] Models train successfully (R² > 0.5)
- [ ] API endpoints return predictions
- [ ] Frontend displays predictions section
- [ ] Predictions update every 10 seconds
- [ ] Device breakdown shows all devices
- [ ] Cost calculations are correct
- [ ] No errors in browser console

---

## Demo Preparation

### Before Presentation:

1. **Ensure Fresh Data:**
   ```bash
   # Check latest data
   curl http://localhost:8000/api/energy/consumption | head -5
   ```

2. **Retrain Models:**
   ```bash
   curl -X POST http://localhost:8000/api/ml/train
   ```

3. **Verify Everything Works:**
   - Open http://localhost:3002
   - Check predictions are visible
   - Toggle a device and see updates

4. **Prepare Talking Points:**
   - "Our system uses machine learning to predict future consumption"
   - "Based on 7 days of historical patterns"
   - "Predicts with X% accuracy" (use R² score)
   - "Shows projected monthly costs"
   - "Helps users plan and optimize energy usage"

### During Demo:

1. Show the dashboard
2. Point out the ML Predictions section
3. Explain the features:
   - Next 24h prediction
   - Monthly projection
   - Device breakdown
4. Open API docs (http://localhost:8000/docs)
5. Show the ML endpoints
6. Execute a prediction live
7. Show the results updating in real-time

---

## Advanced Testing

### Load Testing
```bash
# Test 100 concurrent prediction requests
for i in {1..100}; do
  curl http://localhost:8000/api/ml/predictions/summary?hours=24 &
done
wait
```

### Accuracy Testing
Compare predictions vs actual consumption over time:
```python
# Get prediction for next hour
predictions = get_predictions(hours=1)

# Wait 1 hour
time.sleep(3600)

# Compare with actual consumption
actual = get_consumption(last_hour=True)

# Calculate error
error = abs(predictions - actual) / actual * 100
print(f"Prediction error: {error}%")
```

### Edge Cases
```bash
# Test with no data
curl -X POST http://localhost:8000/api/ml/train

# Test with invalid device
curl http://localhost:8000/api/ml/device/InvalidDevice/predictions

# Test with extreme hours value
curl http://localhost:8000/api/ml/predictions/summary?hours=1000
```

---

## Success Criteria

✅ **Ready for Demo if:**
- All 5 devices have trained models
- R² scores are above 0.5
- API responds in < 200ms
- Frontend displays predictions correctly
- No errors in logs
- Predictions seem reasonable (not negative, not extreme)

🎉 **Perfect if:**
- R² scores are above 0.7
- Predictions match actual patterns
- UI looks polished
- Demo flows smoothly
- You can explain the ML algorithm

---

## Quick Commands Reference

```bash
# Rebuild backend
docker compose build backend

# Check logs
docker logs smart_home_backend

# Train models
curl -X POST http://localhost:8000/api/ml/train

# Get predictions
curl http://localhost:8000/api/ml/predictions/summary

# Check database
docker exec smart_home_postgres psql -U user -d smart_home -c "SELECT COUNT(*) FROM energy_consumption;"

# Restart services
docker compose restart backend frontend

# Full reset
docker compose down
docker compose up -d --build
```

---

Good luck with your testing! 🚀
