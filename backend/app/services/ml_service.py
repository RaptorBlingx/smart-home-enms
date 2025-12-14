"""
Machine Learning Service for Energy Consumption Prediction

This service uses historical energy consumption data to train models
and predict future consumption patterns for each device.
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import joblib
import os
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

class MLService:
    def __init__(self, db: Session):
        self.db = db
        self.models = {}
        self.scalers = {}
        self.training_start_times = {}  # Store training data start time for each device
        self.model_metadata = {}  # Store metadata including use_simple_model flag
        self.model_dir = "app/services/models"
        os.makedirs(self.model_dir, exist_ok=True)
    
    def get_historical_data(self, device_name: str, days: int = 7) -> pd.DataFrame:
        """
        Fetch historical consumption data for a device
        
        Args:
            device_name: Name of the device
            days: Number of days of historical data to fetch
        
        Returns:
            DataFrame with timestamp and consumption columns
        """
        # Use proper PostgreSQL interval syntax with string formatting
        query = text(f"""
            SELECT 
                timestamp,
                consumption
            FROM energy_consumption
            WHERE device_name = :device_name
            AND timestamp >= NOW() - INTERVAL '{days} days'
            ORDER BY timestamp ASC
        """)
        
        result = self.db.execute(query, {"device_name": device_name})
        data = result.fetchall()
        
        if not data:
            logger.warning(f"No historical data found for {device_name}")
            return pd.DataFrame()
        
        df = pd.DataFrame(data, columns=['timestamp', 'consumption'])
        logger.info(f"Fetched {len(df)} records for {device_name}")
        return df
    
    def prepare_features(self, df: pd.DataFrame) -> tuple:
        """
        Prepare features for ML model
        
        Features extracted:
        - Hour of day (0-23)
        - Day of week (0-6)
        - Is weekend (0 or 1)
        - Hour sin/cos encoding (for cyclical nature)
        - Days since start
        
        Args:
            df: DataFrame with timestamp and consumption
        
        Returns:
            X (features), y (targets)
        """
        if df.empty:
            return np.array([]), np.array([])
        
        df = df.copy()
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Extract time features
        df['hour'] = df['timestamp'].dt.hour
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)
        
        # Cyclical encoding for hour (24-hour cycle)
        df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
        df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)
        
        # Days since start
        df['days_since_start'] = (df['timestamp'] - df['timestamp'].min()).dt.total_seconds() / (24 * 3600)
        
        # Select features
        feature_columns = ['hour', 'day_of_week', 'is_weekend', 'hour_sin', 'hour_cos', 'days_since_start']
        X = df[feature_columns].values
        y = df['consumption'].values
        
        return X, y
    
    def train_model(self, device_name: str, days: int = 7) -> Dict:
        """
        Train a prediction model for a specific device
        
        Args:
            device_name: Name of the device
            days: Number of days of historical data to use
        
        Returns:
            Dictionary with training results
        """
        logger.info(f"Training model for {device_name}...")
        
        # Get historical data
        df = self.get_historical_data(device_name, days)
        
        if df.empty or len(df) < 10:
            return {
                "success": False,
                "error": "Insufficient data for training",
                "device_name": device_name
            }
        
        # Store the training data start time for proper feature calculation during prediction
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        self.training_start_times[device_name] = df['timestamp'].min()
        
        # Prepare features
        X, y = self.prepare_features(df)
        
        if len(X) == 0:
            return {
                "success": False,
                "error": "Feature preparation failed",
                "device_name": device_name
            }
        
        # Scale features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # Train model
        model = LinearRegression()
        model.fit(X_scaled, y)
        
        # Calculate training score
        score = model.score(X_scaled, y)
        
        # If R² is very low, we'll use simple averaging instead
        # Store both the model and the historical averages
        use_simple_model = score < 0.1  # R² < 0.1 means poor fit
        
        # Save model, scaler, and training metadata
        self.models[device_name] = model
        self.scalers[device_name] = scaler
        
        # Persist to disk
        model_path = os.path.join(self.model_dir, f"{device_name}_model.pkl")
        scaler_path = os.path.join(self.model_dir, f"{device_name}_scaler.pkl")
        metadata_path = os.path.join(self.model_dir, f"{device_name}_metadata.pkl")
        
        joblib.dump(model, model_path)
        joblib.dump(scaler, scaler_path)
        
        # Calculate hourly averages for simple fallback predictions
        df_with_features = df.copy()
        df_with_features['hour'] = df_with_features['timestamp'].dt.hour
        hourly_avg = df_with_features.groupby('hour')['consumption'].mean().to_dict()
        overall_avg = float(y.mean())
        
        joblib.dump({
            'training_start_time': self.training_start_times[device_name],
            'training_samples': len(X),
            'r2_score': score,
            'use_simple_model': use_simple_model,
            'hourly_averages': hourly_avg,
            'overall_average': overall_avg
        }, metadata_path)
        
        logger.info(f"Model trained for {device_name} with R² score: {score:.4f}")
        
        return {
            "success": True,
            "device_name": device_name,
            "r2_score": round(score, 4),
            "training_samples": len(X),
            "message": f"Model trained successfully with {len(X)} samples"
        }
    
    def load_model(self, device_name: str) -> bool:
        """
        Load a trained model from disk
        
        Args:
            device_name: Name of the device
        
        Returns:
            True if loaded successfully, False otherwise
        """
        model_path = os.path.join(self.model_dir, f"{device_name}_model.pkl")
        scaler_path = os.path.join(self.model_dir, f"{device_name}_scaler.pkl")
        metadata_path = os.path.join(self.model_dir, f"{device_name}_metadata.pkl")
        
        if not os.path.exists(model_path) or not os.path.exists(scaler_path):
            return False
        
        try:
            self.models[device_name] = joblib.load(model_path)
            self.scalers[device_name] = joblib.load(scaler_path)
            
            # Load metadata if it exists
            if os.path.exists(metadata_path):
                metadata = joblib.load(metadata_path)
                self.training_start_times[device_name] = metadata.get('training_start_time')
                self.model_metadata[device_name] = metadata
            
            return True
        except Exception as e:
            logger.error(f"Error loading model for {device_name}: {e}")
            return False
    
    def predict_next_hours(self, device_name: str, hours: int = 24) -> Dict:
        """
        Predict consumption for the next N hours
        
        Args:
            device_name: Name of the device
            hours: Number of hours to predict
        
        Returns:
            Dictionary with predictions
        """
        # Load or train model
        if device_name not in self.models:
            if not self.load_model(device_name):
                train_result = self.train_model(device_name)
                if not train_result["success"]:
                    return train_result
        
        model = self.models[device_name]
        scaler = self.scalers[device_name]
        metadata = self.model_metadata.get(device_name, {})
        
        # Check if we should use simple model
        use_simple_model = metadata.get('use_simple_model', False)
        
        # Generate future timestamps
        now = datetime.now()
        future_times = [now + timedelta(hours=i) for i in range(hours)]
        
        if use_simple_model:
            # Use hourly averages for better predictions when R² is low
            logger.info(f"Using simple averaging model for {device_name} (low R² score)")
            hourly_avg = metadata.get('hourly_averages', {})
            overall_avg = metadata.get('overall_average', 1.0)
            
            predictions = np.array([
                hourly_avg.get(t.hour, overall_avg) 
                for t in future_times
            ])
        else:
            # Use ML model when R² is good
            logger.info(f"Using ML model for {device_name}")
            
            # Get training start time for proper days_since_start calculation
            training_start_time = self.training_start_times.get(device_name)
            if training_start_time is None:
                logger.warning(f"No training start time for {device_name}, using current time")
                training_start_time = datetime.now()
            
            # Prepare features for future times
            future_df = pd.DataFrame({'timestamp': pd.to_datetime(future_times)})
            future_df['hour'] = future_df['timestamp'].dt.hour
            future_df['day_of_week'] = future_df['timestamp'].dt.dayofweek
            future_df['is_weekend'] = (future_df['day_of_week'] >= 5).astype(int)
            future_df['hour_sin'] = np.sin(2 * np.pi * future_df['hour'] / 24)
            future_df['hour_cos'] = np.cos(2 * np.pi * future_df['hour'] / 24)
            
            # Calculate days_since_start relative to training data start
            future_df['days_since_start'] = (future_df['timestamp'] - training_start_time).dt.total_seconds() / (24 * 3600)
            
            feature_columns = ['hour', 'day_of_week', 'is_weekend', 'hour_sin', 'hour_cos', 'days_since_start']
            X_future = future_df[feature_columns].values
            
            # Scale and predict
            X_future_scaled = scaler.transform(X_future)
            predictions = model.predict(X_future_scaled)
        
        # Ensure non-negative and reasonable predictions
        predictions = np.maximum(predictions, 0)
        
        # Add validation to catch unrealistic values
        max_reasonable = 10.0  # Max 10 kWh per hour per device (very conservative)
        if np.max(predictions) > max_reasonable:
            logger.error(f"Unrealistic prediction detected for {device_name}: max={np.max(predictions):.2f} kWh")
            # Cap at maximum reasonable value
            predictions = np.minimum(predictions, max_reasonable)
        
        # Format results
        hourly_predictions = [
            {
                "timestamp": time.isoformat(),
                "hour": time.hour,
                "predicted_consumption": round(float(pred), 4)
            }
            for time, pred in zip(future_times, predictions)
        ]
        
        total_predicted = float(np.sum(predictions))
        avg_predicted = float(np.mean(predictions))
        
        logger.info(f"Predicted {device_name}: total={total_predicted:.2f} kWh, avg={avg_predicted:.4f} kWh/hour")
        
        return {
            "success": True,
            "device_name": device_name,
            "prediction_period_hours": hours,
            "total_predicted_kwh": round(total_predicted, 4),
            "average_predicted_kwh": round(avg_predicted, 4),
            "hourly_predictions": hourly_predictions
        }
    
    def predict_all_devices(self, hours: int = 24) -> Dict:
        """
        Predict consumption for all devices
        
        Args:
            hours: Number of hours to predict
        
        Returns:
            Dictionary with predictions for all devices
        """
        # Get list of devices
        result = self.db.execute(text("SELECT DISTINCT name FROM devices"))
        devices = [row[0] for row in result.fetchall()]
        
        predictions = {}
        total_predicted = 0
        
        for device_name in devices:
            device_prediction = self.predict_next_hours(device_name, hours)
            if device_prediction.get("success"):
                predictions[device_name] = device_prediction
                total_predicted += device_prediction["total_predicted_kwh"]
        
        return {
            "success": True,
            "prediction_period_hours": hours,
            "total_predicted_kwh": round(total_predicted, 4),
            "devices": predictions,
            "timestamp": datetime.now().isoformat()
        }
    
    def get_prediction_summary(self, hours: int = 24) -> Dict:
        """
        Get a summary of predictions with cost estimates
        
        Args:
            hours: Number of hours to predict
        
        Returns:
            Summary with key metrics
        """
        all_predictions = self.predict_all_devices(hours)
        
        if not all_predictions.get("success"):
            return all_predictions
        
        # Get electricity rate from config
        try:
            from config import settings
            electricity_rate = settings.ELECTRICITY_RATE
        except:
            logger.warning("Could not load electricity rate from config, using default 0.12")
            electricity_rate = 0.12
        
        total_kwh = all_predictions["total_predicted_kwh"]
        total_cost = total_kwh * electricity_rate
        
        # Calculate daily and monthly projections
        daily_kwh = total_kwh * (24 / hours) if hours > 0 else total_kwh
        monthly_kwh = daily_kwh * 30
        monthly_cost = monthly_kwh * electricity_rate
        
        # Get device breakdown
        device_breakdown = []
        for device_name, prediction in all_predictions["devices"].items():
            device_kwh = prediction["total_predicted_kwh"]
            device_cost = device_kwh * electricity_rate
            device_breakdown.append({
                "device_name": device_name,
                "predicted_kwh": round(device_kwh, 4),
                "predicted_cost": round(device_cost, 2),
                "percentage": round((device_kwh / total_kwh * 100) if total_kwh > 0 else 0, 2)
            })
        
        # Sort by consumption
        device_breakdown.sort(key=lambda x: x["predicted_kwh"], reverse=True)
        
        return {
            "success": True,
            "prediction_period_hours": hours,
            "next_24h": {
                "total_kwh": round(total_kwh, 4),
                "total_cost": round(total_cost, 2)
            },
            "projected_daily": {
                "total_kwh": round(daily_kwh, 4),
                "total_cost": round(daily_kwh * electricity_rate, 2)
            },
            "projected_monthly": {
                "total_kwh": round(monthly_kwh, 4),
                "total_cost": round(monthly_cost, 2)
            },
            "device_breakdown": device_breakdown,
            "electricity_rate_per_kwh": electricity_rate,
            "timestamp": datetime.now().isoformat()
        }
    
    def train_all_models(self, days: int = 7) -> Dict:
        """
        Train models for all devices
        
        Args:
            days: Number of days of historical data to use
        
        Returns:
            Summary of training results
        """
        result = self.db.execute(text("SELECT DISTINCT name FROM devices"))
        devices = [row[0] for row in result.fetchall()]
        
        results = []
        successful = 0
        failed = 0
        
        for device_name in devices:
            train_result = self.train_model(device_name, days)
            results.append(train_result)
            
            if train_result.get("success"):
                successful += 1
            else:
                failed += 1
        
        return {
            "success": True,
            "total_devices": len(devices),
            "successful": successful,
            "failed": failed,
            "results": results,
            "timestamp": datetime.now().isoformat()
        }
