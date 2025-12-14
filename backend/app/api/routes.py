from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from models.energy import EnergyConsumptionSchema, EnergyDeviceSchema
from services.energy_service import EnergyService
from services.efficiency_service import EfficiencyService
from database.connection import get_db
from typing import List
import paho.mqtt.client as mqtt
import json
import os

router = APIRouter(prefix="/api")

# MQTT Client Setup
MQTT_BROKER = os.getenv("MQTT_BROKER", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))

# Create MQTT client (compatible with paho-mqtt 1.6.1)
mqtt_client = mqtt.Client(
    client_id="smart_home_backend",
    clean_session=True
)

def on_mqtt_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✅ Backend MQTT client connected successfully")
    else:
        print(f"❌ Backend MQTT connection failed with code {rc}")

mqtt_client.on_connect = on_mqtt_connect

def connect_mqtt():
    try:
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_start()  # Start network loop in background
        print(f"✅ Connected to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}")
    except Exception as e:
        print(f"❌ Failed to connect to MQTT broker: {e}")

connect_mqtt()

@router.post("/energy/consumption")
async def create_energy_consumption(
    consumption: EnergyConsumptionSchema,
    db: Session = Depends(get_db)
):
    # Check if device is ON before recording consumption
    result = db.execute(
        text("SELECT status FROM devices WHERE name = :name"),
        {"name": consumption.device_name}
    ).fetchone()
    
    if result is None:
        raise HTTPException(status_code=404, detail=f"Device '{consumption.device_name}' not found")
    
    device_status = result[0]
    if device_status != "on":
        return {
            "message": f"Device '{consumption.device_name}' is OFF. Consumption not recorded.",
            "device_name": consumption.device_name,
            "status": device_status,
            "recorded": False
        }
    
    # Device is ON, record consumption
    service = EnergyService(db)
    return await service.record_consumption(consumption)

@router.get("/energy/consumption/{device_name}")
async def get_energy_consumption(
    device_name: str,
    db: Session = Depends(get_db)
):
    service = EnergyService(db)
    return await service.get_consumption(device_name)

@router.get("/energy/consumption")
async def list_energy_consumptions(db: Session = Depends(get_db)):
    service = EnergyService(db)
    return await service.list_consumptions()

@router.get("/devices")
def get_devices(db: Session = Depends(get_db)):
    """Get all devices with their current status"""
    result = db.execute(text("SELECT id, name, type, status, last_updated FROM devices ORDER BY id"))
    devices = []
    for row in result:
        devices.append({
            "id": row[0],
            "name": row[1],
            "type": row[2],
            "status": row[3],
            "lastUpdated": row[4].isoformat() if row[4] else None
        })
    return devices

@router.patch("/devices/{device_id}/toggle")
def toggle_device(device_id: int, db: Session = Depends(get_db)):
    """Toggle device on/off status"""
    # Get current device
    result = db.execute(
        text("SELECT id, name, status FROM devices WHERE id = :id"),
        {"id": device_id}
    ).fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="Device not found")
    
    device_name = result[1]
    current_status = result[2]
    new_status = "off" if current_status == "on" else "on"
    
    # Update database
    db.execute(
        text("UPDATE devices SET status = :status, last_updated = CURRENT_TIMESTAMP WHERE id = :id"),
        {"status": new_status, "id": device_id}
    )
    db.commit()
    
    # Publish MQTT control message
    control_topic = f"smart_home/control/{device_name}"
    control_message = json.dumps({
        "device_name": device_name,
        "command": new_status,
        "timestamp": str(db.execute(text("SELECT CURRENT_TIMESTAMP")).fetchone()[0])
    })
    
    try:
        result = mqtt_client.publish(control_topic, control_message)
        if result.rc == 0:
            print(f"📤 Published control: {control_topic} -> {new_status}")
            print(f"   Message: {control_message}")
        else:
            print(f"⚠️  MQTT publish failed with code: {result.rc}")
    except Exception as e:
        print(f"⚠️  MQTT publish exception: {e}")
    
    return {
        "id": device_id,
        "name": device_name,
        "status": new_status,
        "message": f"Device {device_name} turned {new_status}"
    }

@router.get("/energy")
async def get_energy_stats(db: Session = Depends(get_db)):
    from config import settings
    service = EnergyService(db)
    consumptions = await service.list_consumptions()
    
    total = sum(c.consumption for c in consumptions) if consumptions else 0
    avg = total / len(consumptions) if consumptions else 0
    
    return {
        "totalConsumption": round(total, 2),
        "peakUsage": round(max([c.consumption for c in consumptions], default=0), 2),
        "averageCost": round(avg * settings.ELECTRICITY_RATE, 2)
    }

@router.get("/energy/cost")
async def get_energy_cost(
    period: str = "7days",  # hourly, daily, weekly, monthly, 7days, 30days
    db: Session = Depends(get_db)
):
    """
    Calculate energy costs for different time periods
    """
    from config import settings
    from datetime import datetime, timedelta
    
    # Determine time range
    now = datetime.now()
    if period == "hourly":
        start_time = now - timedelta(hours=24)
        group_by = "DATE_TRUNC('hour', timestamp)"
    elif period == "daily":
        start_time = now - timedelta(days=7)
        group_by = "DATE_TRUNC('day', timestamp)"
    elif period == "weekly":
        start_time = now - timedelta(weeks=4)
        group_by = "DATE_TRUNC('week', timestamp)"
    elif period == "monthly":
        start_time = now - timedelta(days=365)
        group_by = "DATE_TRUNC('month', timestamp)"
    elif period == "30days":
        start_time = now - timedelta(days=30)
        group_by = "DATE_TRUNC('day', timestamp)"
    else:  # 7days default
        start_time = now - timedelta(days=7)
        group_by = "DATE_TRUNC('day', timestamp)"
    
    # Get total cost
    total_query = text("""
        SELECT 
            SUM(consumption) as total_consumption,
            COUNT(*) as data_points
        FROM energy_consumption
        WHERE timestamp >= :start_time
    """)
    total_result = db.execute(total_query, {"start_time": start_time}).fetchone()
    total_consumption = float(total_result[0]) if total_result[0] else 0.0
    total_cost = round(total_consumption * settings.ELECTRICITY_RATE, 2)
    
    # Get cost by device
    device_query = text("""
        SELECT 
            device_name,
            SUM(consumption) as consumption,
            COUNT(*) as readings
        FROM energy_consumption
        WHERE timestamp >= :start_time
        GROUP BY device_name
        ORDER BY consumption DESC
    """)
    device_results = db.execute(device_query, {"start_time": start_time}).fetchall()
    
    devices_cost = []
    for row in device_results:
        device_consumption = float(row[1])
        device_cost = round(device_consumption * settings.ELECTRICITY_RATE, 2)
        devices_cost.append({
            "device": row[0],
            "consumption": round(device_consumption, 3),
            "cost": device_cost,
            "percentage": round((device_consumption / total_consumption * 100) if total_consumption > 0 else 0, 1)
        })
    
    # Get cost by time period
    period_query = text(f"""
        SELECT 
            {group_by} as period,
            SUM(consumption) as consumption
        FROM energy_consumption
        WHERE timestamp >= :start_time
        GROUP BY period
        ORDER BY period DESC
        LIMIT 30
    """)
    period_results = db.execute(period_query, {"start_time": start_time}).fetchall()
    
    periods_cost = []
    for row in period_results:
        period_consumption = float(row[1])
        period_cost = round(period_consumption * settings.ELECTRICITY_RATE, 2)
        periods_cost.append({
            "period": row[0].isoformat() if row[0] else None,
            "consumption": round(period_consumption, 3),
            "cost": period_cost
        })
    
    # Calculate projected monthly cost
    days_elapsed = (now - start_time).days
    if days_elapsed > 0:
        daily_avg_cost = total_cost / days_elapsed
        projected_monthly = round(daily_avg_cost * 30, 2)
    else:
        projected_monthly = 0.0
    
    return {
        "period": period,
        "electricityRate": settings.ELECTRICITY_RATE,
        "totalConsumption": round(total_consumption, 2),
        "totalCost": total_cost,
        "projectedMonthlyCost": projected_monthly,
        "devicesCost": devices_cost,
        "periodsCost": periods_cost,
        "startTime": start_time.isoformat(),
        "endTime": now.isoformat()
    }

@router.get("/energy/stats")
async def get_energy_stats_detailed(
    period: str = "24h",  # 24h, 7d, 30d, 1y
    db: Session = Depends(get_db)
):
    """
    Get detailed energy statistics with time-series data for charts
    """
    from config import settings
    from datetime import datetime, timedelta
    
    # Determine time range and grouping
    now = datetime.now()
    if period == "24h":
        start_time = now - timedelta(hours=24)
        group_by = "DATE_TRUNC('hour', timestamp)"
        label_format = "hour"
    elif period == "7d":
        start_time = now - timedelta(days=7)
        group_by = "DATE_TRUNC('day', timestamp)"
        label_format = "day"
    elif period == "30d":
        start_time = now - timedelta(days=30)
        group_by = "DATE_TRUNC('day', timestamp)"
        label_format = "day"
    else:  # 1y
        start_time = now - timedelta(days=365)
        group_by = "DATE_TRUNC('month', timestamp)"
        label_format = "month"
    
    # Time series data - consumption over time
    timeseries_query = text(f"""
        SELECT 
            {group_by} as period,
            SUM(consumption) as total_consumption,
            AVG(consumption) as avg_consumption,
            MAX(consumption) as peak_consumption,
            COUNT(*) as readings
        FROM energy_consumption
        WHERE timestamp >= :start_time
        GROUP BY period
        ORDER BY period ASC
    """)
    timeseries_results = db.execute(timeseries_query, {"start_time": start_time}).fetchall()
    
    timeseries_data = []
    for row in timeseries_results:
        timeseries_data.append({
            "period": row[0].isoformat() if row[0] else None,
            "totalConsumption": round(float(row[1]), 3),
            "avgConsumption": round(float(row[2]), 4),
            "peakConsumption": round(float(row[3]), 4),
            "readings": row[4],
            "cost": round(float(row[1]) * settings.ELECTRICITY_RATE, 2)
        })
    
    # Device breakdown over time
    device_timeseries_query = text(f"""
        SELECT 
            device_name,
            {group_by} as period,
            SUM(consumption) as consumption
        FROM energy_consumption
        WHERE timestamp >= :start_time
        GROUP BY device_name, period
        ORDER BY device_name, period ASC
    """)
    device_timeseries_results = db.execute(device_timeseries_query, {"start_time": start_time}).fetchall()
    
    # Organize by device
    device_series = {}
    for row in device_timeseries_results:
        device_name = row[0]
        if device_name not in device_series:
            device_series[device_name] = []
        device_series[device_name].append({
            "period": row[1].isoformat() if row[1] else None,
            "consumption": round(float(row[2]), 3)
        })
    
    # Total statistics
    total_stats_query = text("""
        SELECT 
            SUM(consumption) as total,
            AVG(consumption) as average,
            MAX(consumption) as peak,
            MIN(consumption) as minimum,
            COUNT(*) as readings
        FROM energy_consumption
        WHERE timestamp >= :start_time
    """)
    total_stats = db.execute(total_stats_query, {"start_time": start_time}).fetchone()
    
    # Device totals
    device_totals_query = text("""
        SELECT 
            device_name,
            SUM(consumption) as total_consumption,
            AVG(consumption) as avg_consumption,
            COUNT(*) as readings
        FROM energy_consumption
        WHERE timestamp >= :start_time
        GROUP BY device_name
        ORDER BY total_consumption DESC
    """)
    device_totals_results = db.execute(device_totals_query, {"start_time": start_time}).fetchall()
    
    device_totals = []
    total_consumption = float(total_stats[0]) if total_stats[0] else 0.0
    for row in device_totals_results:
        device_consumption = float(row[1])
        device_totals.append({
            "device": row[0],
            "totalConsumption": round(device_consumption, 3),
            "avgConsumption": round(float(row[2]), 4),
            "readings": row[3],
            "percentage": round((device_consumption / total_consumption * 100) if total_consumption > 0 else 0, 1),
            "cost": round(device_consumption * settings.ELECTRICITY_RATE, 2)
        })
    
    return {
        "period": period,
        "startTime": start_time.isoformat(),
        "endTime": now.isoformat(),
        "electricityRate": settings.ELECTRICITY_RATE,
        "summary": {
            "totalConsumption": round(float(total_stats[0]) if total_stats[0] else 0.0, 2),
            "avgConsumption": round(float(total_stats[1]) if total_stats[1] else 0.0, 4),
            "peakConsumption": round(float(total_stats[2]) if total_stats[2] else 0.0, 4),
            "minConsumption": round(float(total_stats[3]) if total_stats[3] else 0.0, 4),
            "totalReadings": total_stats[4],
            "totalCost": round((float(total_stats[0]) if total_stats[0] else 0.0) * settings.ELECTRICITY_RATE, 2)
        },
        "timeseries": timeseries_data,
        "deviceSeries": device_series,
        "deviceTotals": device_totals
    }

# ============================================================================
# ML Prediction Endpoints
# ============================================================================

@router.get("/ml/predictions")
async def get_predictions(
    hours: int = 24,
    device: str = None,
    db: Session = Depends(get_db)
):
    """
    Get ML-based consumption predictions for the next N hours
    
    Args:
        hours: Number of hours to predict (default: 24)
        device: Specific device name (optional, if not provided returns all devices)
    
    Returns:
        Predictions with confidence intervals
    """
    from services.ml_service import MLService
    
    ml_service = MLService(db)
    
    if device:
        # Predict for specific device
        result = ml_service.predict_next_hours(device, hours)
    else:
        # Predict for all devices
        result = ml_service.predict_all_devices(hours)
    
    return result

@router.get("/ml/predictions/summary")
async def get_predictions_summary(
    hours: int = 24,
    db: Session = Depends(get_db)
):
    """
    Get a summary of predictions with cost estimates and projections
    
    This is the recommended endpoint for dashboard display as it includes:
    - Total predicted consumption and cost
    - Daily and monthly projections
    - Device breakdown with percentages
    - Cost calculations
    
    Args:
        hours: Number of hours to predict (default: 24)
    
    Returns:
        Summary with key metrics and projections
    """
    from services.ml_service import MLService
    
    ml_service = MLService(db)
    result = ml_service.get_prediction_summary(hours)
    
    return result

@router.post("/ml/train")
async def train_models(
    device: str = None,
    days: int = 7,
    db: Session = Depends(get_db)
):
    """
    Train or retrain ML models
    
    Args:
        device: Specific device to train (optional, if not provided trains all)
        days: Number of days of historical data to use (default: 7)
    
    Returns:
        Training results
    """
    from services.ml_service import MLService
    
    ml_service = MLService(db)
    
    if device:
        # Train specific device
        result = ml_service.train_model(device, days)
    else:
        # Train all devices
        result = ml_service.train_all_models(days)
    
    return result

@router.get("/ml/device/{device_name}/predictions")
async def get_device_predictions(
    device_name: str,
    hours: int = 24,
    db: Session = Depends(get_db)
):
    """
    Get detailed predictions for a specific device
    
    Args:
        device_name: Name of the device
        hours: Number of hours to predict
    
    Returns:
        Hourly predictions with timestamps
    """
    from services.ml_service import MLService
    
    ml_service = MLService(db)
    result = ml_service.predict_next_hours(device_name, hours)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Prediction failed"))
    
    return result


# ============================================================================
# EFFICIENCY & RECOMMENDATIONS ENDPOINTS
# ============================================================================

@router.get("/efficiency/score")
async def get_efficiency_score(
    days: int = 7,
    db: Session = Depends(get_db)
):
    """
    Get energy efficiency score and grade
    
    Args:
        days: Number of days to analyze (default 7)
    
    Returns:
        Score (0-100), grade (A+ to F), comparison, tips, historical data
    """
    efficiency_service = EfficiencyService(db)
    result = efficiency_service.calculate_efficiency_score(days)
    return result


@router.get("/efficiency/insights")
async def get_efficiency_insights(db: Session = Depends(get_db)):
    """
    Get detailed efficiency insights
    
    Returns:
        Device-level and time-based efficiency analysis
    """
    efficiency_service = EfficiencyService(db)
    result = efficiency_service.get_efficiency_insights()
    return result


@router.get("/energy/peak-hours")
async def get_peak_hours(
    days: int = 7,
    db: Session = Depends(get_db)
):
    """
    Get peak consumption hours analysis
    
    Args:
        days: Number of days to analyze (default 7)
    
    Returns:
        Hourly average consumption, peak hours, off-peak hours, potential savings
    """
    from datetime import datetime, timedelta
    from sqlalchemy import func
    from models.energy import EnergyConsumption
    
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Get hourly consumption averages
        hourly_data = db.query(
            func.extract('hour', EnergyConsumption.timestamp).label('hour'),
            func.avg(EnergyConsumption.consumption).label('avg_consumption'),
            func.sum(EnergyConsumption.consumption).label('total_consumption'),
            func.count(EnergyConsumption.id).label('count')
        ).filter(
            EnergyConsumption.timestamp >= start_date
        ).group_by(
            func.extract('hour', EnergyConsumption.timestamp)
        ).order_by('hour').all()
        
        # Convert to dictionary
        hourly_avg = {}
        hourly_total = {}
        for row in hourly_data:
            hour = int(row.hour)
            hourly_avg[hour] = round(row.avg_consumption, 3)
            hourly_total[hour] = round(row.total_consumption, 2)
        
        # Fill missing hours with 0
        for hour in range(24):
            if hour not in hourly_avg:
                hourly_avg[hour] = 0.0
                hourly_total[hour] = 0.0
        
        # Identify peak and off-peak hours
        if hourly_avg:
            sorted_hours = sorted(hourly_avg.items(), key=lambda x: x[1], reverse=True)
            peak_hours = [hour for hour, _ in sorted_hours[:3]]  # Top 3 peak hours
            off_peak_hours = [hour for hour, _ in sorted_hours[-3:]]  # Bottom 3 off-peak hours
            
            peak_avg = sum(hourly_avg[h] for h in peak_hours) / len(peak_hours)
            off_peak_avg = sum(hourly_avg[h] for h in off_peak_hours) / len(off_peak_hours)
        else:
            peak_hours = [19, 20, 21]
            off_peak_hours = [2, 3, 4]
            peak_avg = 0
            off_peak_avg = 0
        
        # Calculate potential savings (assuming 30% rate difference between peak and off-peak)
        total_peak_consumption = sum(hourly_total[h] for h in peak_hours)
        potential_savings_kwh = total_peak_consumption * 0.3
        potential_savings_monthly = (potential_savings_kwh / days) * 30 * 0.12  # $0.12/kWh
        
        # Generate recommendations
        recommendations = []
        if peak_avg > off_peak_avg * 1.5:
            recommendations.append({
                "title": "Shift High-Power Usage",
                "description": f"Move washing machine and other high-power devices to off-peak hours ({off_peak_hours[0]}:00 - {off_peak_hours[-1]}:00)",
                "savings": f"${potential_savings_monthly:.2f}/month"
            })
        
        if max(hourly_avg.values()) > 2.0:
            recommendations.append({
                "title": "Reduce Peak Consumption",
                "description": f"Peak hour ({peak_hours[0]}:00) consumption is very high. Avoid running multiple devices simultaneously.",
                "savings": f"Up to ${potential_savings_monthly * 0.5:.2f}/month"
            })
        
        return {
            "period_days": days,
            "hourly_avg": hourly_avg,
            "hourly_total": hourly_total,
            "peak_hours": peak_hours,
            "off_peak_hours": off_peak_hours,
            "peak_avg_consumption": round(peak_avg, 3),
            "off_peak_avg_consumption": round(off_peak_avg, 3),
            "potential_savings_kwh": round(potential_savings_kwh, 2),
            "potential_savings_monthly": round(potential_savings_monthly, 2),
            "recommendations": recommendations
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing peak hours: {str(e)}")


@router.get("/recommendations")
async def get_recommendations(db: Session = Depends(get_db)):
    """
    Get smart recommendations to reduce energy consumption
    
    Returns:
        List of actionable recommendations with priority and potential savings
    """
    from datetime import datetime, timedelta
    from sqlalchemy import func
    from models.energy import EnergyConsumption
    
    try:
        recommendations = []
        end_date = datetime.now()
        start_date = end_date - timedelta(days=7)
        
        # Analyze device usage patterns
        device_data = db.query(
            EnergyConsumption.device_name,
            func.sum(EnergyConsumption.consumption).label('total'),
            func.avg(EnergyConsumption.consumption).label('average'),
            func.count(EnergyConsumption.id).label('count')
        ).filter(
            EnergyConsumption.timestamp >= start_date
        ).group_by(
            EnergyConsumption.device_name
        ).all()
        
        total_consumption = sum(d.total for d in device_data)
        
        # Recommendation 1: High consumption devices
        for device in device_data:
            device_percentage = (device.total / total_consumption * 100) if total_consumption > 0 else 0
            
            if device_percentage > 40:
                recommendations.append({
                    "id": len(recommendations) + 1,
                    "priority": "high",
                    "type": "high_consumption",
                    "device": device.device_name,
                    "title": f"High Consumption Alert: {device.device_name}",
                    "message": f"{device.device_name} accounts for {device_percentage:.1f}% of total consumption",
                    "action": "Consider upgrading to energy-efficient model or reducing usage time",
                    "savings": f"${(device.total * 0.12 * 0.3):.2f}/week",
                    "impact": "high"
                })
        
        # Recommendation 2: Always-on devices
        for device in device_data:
            readings_per_day = device.count / 7
            if readings_per_day > 140:  # More than ~144 readings/day (every 10 min)
                recommendations.append({
                    "id": len(recommendations) + 1,
                    "priority": "medium",
                    "type": "always_on",
                    "device": device.device_name,
                    "title": f"Always-On Device: {device.device_name}",
                    "message": f"{device.device_name} has been running continuously",
                    "action": "Turn off when not in use to save energy",
                    "savings": f"${(device.total * 0.12 * 0.2):.2f}/week",
                    "impact": "medium"
                })
        
        # Recommendation 3: Peak hours usage
        peak_consumption = db.query(
            func.sum(EnergyConsumption.consumption)
        ).filter(
            EnergyConsumption.timestamp >= start_date,
            func.extract('hour', EnergyConsumption.timestamp).between(18, 22)
        ).scalar() or 0.0
        
        if peak_consumption > total_consumption * 0.35:
            recommendations.append({
                "id": len(recommendations) + 1,
                "priority": "high",
                "type": "peak_hours",
                "device": "Multiple",
                "title": "Peak Hours Consumption",
                "message": "35%+ of consumption occurs during peak hours (6 PM - 10 PM)",
                "action": "Shift washing machine and other flexible loads to 2 AM - 6 AM",
                "savings": f"${(peak_consumption * 0.12 * 0.25):.2f}/week",
                "impact": "high"
            })
        
        # Recommendation 4: General efficiency
        if total_consumption / 7 > 35:  # More than 35 kWh/day average
            recommendations.append({
                "id": len(recommendations) + 1,
                "priority": "medium",
                "type": "general",
                "device": "All",
                "title": "Overall Efficiency Improvement",
                "message": "Daily consumption is above average household levels",
                "action": "Review all devices and identify inefficient appliances",
                "savings": f"${(total_consumption * 0.12 * 0.15):.2f}/week",
                "impact": "medium"
            })
        
        # Sort by priority
        priority_order = {"high": 0, "medium": 1, "low": 2}
        recommendations.sort(key=lambda x: priority_order.get(x["priority"], 3))
        
        return {
            "recommendations": recommendations[:5],  # Return top 5
            "total_recommendations": len(recommendations),
            "analysis_period_days": 7
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating recommendations: {str(e)}")