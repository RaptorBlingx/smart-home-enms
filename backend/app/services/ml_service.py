"""
Machine Learning Service for Energy Consumption Prediction

This service uses advanced machine learning techniques to train models
and predict future consumption patterns for each device.

Features:
- Extended 30-day training window for better pattern learning
- Advanced feature engineering (lag features, rolling averages, interactions)
- Random Forest Regressor for non-linear pattern capture
- Gradient Boosting for high-accuracy predictions
- Feature importance analysis
- Proper train/test split validation
- Smart fallback to statistical models when needed
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import joblib
import os
from typing import Dict, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

class MLService:
    def __init__(self, db: Session):
        self.db = db
        self.models = {}
        self.scalers = {}
        self.training_start_times = {}
        self.model_metadata = {}
        self.feature_importances = {}
        self.model_dir = "app/services/models"
        os.makedirs(self.model_dir, exist_ok=True)
    
    def get_historical_data(self, device_name: str, days: int = 30) -> pd.DataFrame:
        """
        Fetch historical consumption data for a device
        
        Args:
            device_name: Name of the device
            days: Number of days of historical data to fetch (default: 30 for better patterns)
        
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
        logger.info(f"Fetched {len(df)} records for {device_name} ({days} days)")
        return df
    
    def prepare_features(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """
        Prepare advanced features for ML model
        
        Features extracted:
        - Time features: hour, day_of_week, is_weekend, month
        - Cyclical encoding: hour_sin/cos, day_sin/cos
        - Lag features: consumption from 1h, 2h, 24h ago
        - Rolling averages: 3h, 6h, 24h
        - Statistical features: rolling std, min, max
        - Interaction features: hour × is_weekend
        - Trend: days_since_start
        
        Args:
            df: DataFrame with timestamp and consumption
        
        Returns:
            X (features), y (targets), feature_names
        """
        if df.empty or len(df) < 50:
            return np.array([]), np.array([]), []
        
        df = df.copy()
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp').reset_index(drop=True)
        
        # Basic time features
        df['hour'] = df['timestamp'].dt.hour
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)
        df['month'] = df['timestamp'].dt.month
        
        # Cyclical encoding for periodicity
        df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
        df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)
        df['day_sin'] = np.sin(2 * np.pi * df['day_of_week'] / 7)
        df['day_cos'] = np.cos(2 * np.pi * df['day_of_week'] / 7)
        
        # Trend feature
        df['days_since_start'] = (df['timestamp'] - df['timestamp'].min()).dt.total_seconds() / (24 * 3600)
        
        # LAG FEATURES (previous consumption values)
        df['consumption_lag_1h'] = df['consumption'].shift(1)  # 1 hour ago
        df['consumption_lag_2h'] = df['consumption'].shift(2)  # 2 hours ago
        df['consumption_lag_24h'] = df['consumption'].shift(24)  # Same time yesterday
        
        # ROLLING AVERAGES (smoothed patterns)
        df['consumption_rolling_3h'] = df['consumption'].rolling(window=3, min_periods=1).mean()
        df['consumption_rolling_6h'] = df['consumption'].rolling(window=6, min_periods=1).mean()
        df['consumption_rolling_24h'] = df['consumption'].rolling(window=24, min_periods=1).mean()
        
        # ROLLING STATISTICS (variability indicators)
        df['consumption_rolling_std_6h'] = df['consumption'].rolling(window=6, min_periods=1).std().fillna(0)
        df['consumption_rolling_min_24h'] = df['consumption'].rolling(window=24, min_periods=1).min()
        df['consumption_rolling_max_24h'] = df['consumption'].rolling(window=24, min_periods=1).max()
        
        # INTERACTION FEATURES (combined effects)
        df['hour_weekend_interaction'] = df['hour'] * df['is_weekend']
        
        # Fill NaN values from lag/rolling operations
        df = df.fillna(method='bfill').fillna(method='ffill').fillna(0)
        
        # Select all feature columns
        feature_columns = [
            'hour', 'day_of_week', 'is_weekend', 'month',
            'hour_sin', 'hour_cos', 'day_sin', 'day_cos',
            'days_since_start',
            'consumption_lag_1h', 'consumption_lag_2h', 'consumption_lag_24h',
            'consumption_rolling_3h', 'consumption_rolling_6h', 'consumption_rolling_24h',
            'consumption_rolling_std_6h', 'consumption_rolling_min_24h', 'consumption_rolling_max_24h',
            'hour_weekend_interaction'
        ]
        
        X = df[feature_columns].values
        y = df['consumption'].values
        
        logger.info(f"Prepared {len(feature_columns)} features from {len(df)} samples")
        
        return X, y, feature_columns
    
    def train_model(self, device_name: str, days: int = 30) -> Dict:
        """
        Train an advanced prediction model for a specific device
        
        Uses Random Forest for non-linear pattern capture with proper validation
        
        Args:
            device_name: Name of the device
            days: Number of days of historical data to use (default: 30)
        
        Returns:
            Dictionary with training results including metrics
        """
        logger.info(f"Training advanced model for {device_name} with {days} days of data...")
        
        # Get historical data
        df = self.get_historical_data(device_name, days)
        
        if df.empty or len(df) < 100:
            return {
                "success": False,
                "error": f"Insufficient data for training (need 100+ samples, got {len(df)})",
                "device_name": device_name
            }
        
        # Store the training data start time
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        self.training_start_times[device_name] = df['timestamp'].min()
        
        # Prepare advanced features
        X, y, feature_names = self.prepare_features(df)
        
        if len(X) == 0:
            return {
                "success": False,
                "error": "Feature preparation failed",
                "device_name": device_name
            }
        
        # Train/test split for proper validation
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, shuffle=False  # Keep chronological order
        )
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Try multiple algorithms and select best
        models_to_try = {
            'RandomForest': RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42,
                n_jobs=-1
            ),
            'GradientBoosting': GradientBoostingRegressor(
                n_estimators=100,
                max_depth=5,
                learning_rate=0.1,
                random_state=42
            ),
            'Ridge': Ridge(alpha=1.0)
        }
        
        best_model = None
        best_score = -float('inf')
        best_model_name = None
        all_results = {}
        
        for model_name, model in models_to_try.items():
            try:
                # Train model
                model.fit(X_train_scaled, y_train)
                
                # Evaluate on test set
                y_pred_test = model.predict(X_test_scaled)
                test_r2 = r2_score(y_test, y_pred_test)
                test_mae = mean_absolute_error(y_test, y_pred_test)
                test_rmse = np.sqrt(mean_squared_error(y_test, y_pred_test))
                
                # Cross-validation score
                cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5, scoring='r2')
                cv_mean = np.mean(cv_scores)
                
                all_results[model_name] = {
                    'test_r2': test_r2,
                    'test_mae': test_mae,
                    'test_rmse': test_rmse,
                    'cv_r2_mean': cv_mean
                }
                
                logger.info(f"{model_name}: R²={test_r2:.4f}, MAE={test_mae:.4f}, CV-R²={cv_mean:.4f}")
                
                # Select best based on test R²
                if test_r2 > best_score:
                    best_score = test_r2
                    best_model = model
                    best_model_name = model_name
                    
            except Exception as e:
                logger.error(f"Error training {model_name} for {device_name}: {e}")
                continue
        
        if best_model is None:
            return {
                "success": False,
                "error": "All models failed to train",
                "device_name": device_name
            }
        
        # Get final metrics
        y_pred_train = best_model.predict(X_train_scaled)
        train_r2 = r2_score(y_train, y_pred_train)
        
        y_pred_test = best_model.predict(X_test_scaled)
        test_r2 = r2_score(y_test, y_pred_test)
        test_mae = mean_absolute_error(y_test, y_pred_test)
        
        # Feature importance (for tree-based models)
        feature_importance = None
        if hasattr(best_model, 'feature_importances_'):
            importance_dict = dict(zip(feature_names, best_model.feature_importances_))
            # Sort by importance
            feature_importance = dict(sorted(importance_dict.items(), key=lambda x: x[1], reverse=True))
            self.feature_importances[device_name] = feature_importance
            logger.info(f"Top 3 features: {list(feature_importance.keys())[:3]}")
        
        # Determine if model is good enough
        use_simple_model = test_r2 < 0.3  # Threshold raised to 0.3
        
        # Save model, scaler, and metadata
        self.models[device_name] = best_model
        self.scalers[device_name] = scaler
        
        # Persist to disk
        model_path = os.path.join(self.model_dir, f"{device_name}_model.pkl")
        scaler_path = os.path.join(self.model_dir, f"{device_name}_scaler.pkl")
        metadata_path = os.path.join(self.model_dir, f"{device_name}_metadata.pkl")
        
        joblib.dump(best_model, model_path)
        joblib.dump(scaler, scaler_path)
        
        # Calculate hourly averages for fallback
        df_with_features = df.copy()
        df_with_features['hour'] = df_with_features['timestamp'].dt.hour
        hourly_avg = df_with_features.groupby('hour')['consumption'].mean().to_dict()
        overall_avg = float(y.mean())
        
        metadata = {
            'training_start_time': self.training_start_times[device_name],
            'training_samples': len(X_train),
            'test_samples': len(X_test),
            'train_r2_score': float(train_r2),
            'test_r2_score': float(test_r2),
            'test_mae': float(test_mae),
            'algorithm': best_model_name,
            'use_simple_model': bool(use_simple_model),
            'hourly_averages': hourly_avg,
            'overall_average': overall_avg,
            'feature_names': feature_names,
            'feature_importance': {k: float(v) for k, v in feature_importance.items()} if feature_importance else None,
            'all_model_results': all_results
        }
        
        joblib.dump(metadata, metadata_path)
        self.model_metadata[device_name] = metadata
        
        logger.info(f"✓ Model trained for {device_name}: {best_model_name}, Test R²={test_r2:.4f}, MAE={test_mae:.4f}")
        
        return {
            "success": True,
            "device_name": device_name,
            "algorithm": best_model_name,
            "train_r2_score": round(float(train_r2), 4),
            "test_r2_score": round(float(test_r2), 4),
            "test_mae": round(float(test_mae), 4),
            "training_samples": len(X_train),
            "test_samples": len(X_test),
            "use_simple_model": bool(use_simple_model),
            "message": f"Model trained with {len(X_train)} samples, test R²={test_r2:.4f}"
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
        Predict consumption for the next N hours using advanced features
        
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
            # Use advanced ML model - need historical data for lag/rolling features
            logger.info(f"Using advanced ML model for {device_name}")
            
            # Fetch recent historical data (24 hours) for lag and rolling features
            historical_df = self.get_historical_data(device_name, days=2)  # Get 2 days to be safe
            
            if historical_df.empty or len(historical_df) < 50:
                logger.warning(f"Insufficient historical data for {device_name}, using averages")
                hourly_avg = metadata.get('hourly_averages', {})
                overall_avg = metadata.get('overall_average', 1.0)
                predictions = np.array([hourly_avg.get(t.hour, overall_avg) for t in future_times])
            else:
                # Prepare historical data with features
                historical_df['timestamp'] = pd.to_datetime(historical_df['timestamp'])
                historical_df = historical_df.sort_values('timestamp').reset_index(drop=True)
                
                # Create future dataframe
                future_df = pd.DataFrame({
                    'timestamp': pd.to_datetime(future_times),
                    'consumption': np.nan  # We'll fill this iteratively
                })
                
                # Combine historical and future
                combined_df = pd.concat([historical_df, future_df], ignore_index=True)
                combined_df = combined_df.sort_values('timestamp').reset_index(drop=True)
                
                # Find where future starts
                future_start_idx = len(historical_df)
                
                # Prepare all features on combined dataframe
                training_start_time = self.training_start_times.get(device_name, combined_df['timestamp'].min())
                
                # Basic time features
                combined_df['hour'] = combined_df['timestamp'].dt.hour
                combined_df['day_of_week'] = combined_df['timestamp'].dt.dayofweek
                combined_df['is_weekend'] = (combined_df['day_of_week'] >= 5).astype(int)
                combined_df['month'] = combined_df['timestamp'].dt.month
                
                # Cyclical encoding
                combined_df['hour_sin'] = np.sin(2 * np.pi * combined_df['hour'] / 24)
                combined_df['hour_cos'] = np.cos(2 * np.pi * combined_df['hour'] / 24)
                combined_df['day_sin'] = np.sin(2 * np.pi * combined_df['day_of_week'] / 7)
                combined_df['day_cos'] = np.cos(2 * np.pi * combined_df['day_of_week'] / 7)
                
                # Trend
                combined_df['days_since_start'] = (combined_df['timestamp'] - training_start_time).dt.total_seconds() / (24 * 3600)
                
                # Now predict iteratively to build up lag features
                predictions = []
                
                feature_columns = [
                    'hour', 'day_of_week', 'is_weekend', 'month',
                    'hour_sin', 'hour_cos', 'day_sin', 'day_cos',
                    'days_since_start',
                    'consumption_lag_1h', 'consumption_lag_2h', 'consumption_lag_24h',
                    'consumption_rolling_3h', 'consumption_rolling_6h', 'consumption_rolling_24h',
                    'consumption_rolling_std_6h', 'consumption_rolling_min_24h', 'consumption_rolling_max_24h',
                    'hour_weekend_interaction'
                ]
                
                for i in range(future_start_idx, len(combined_df)):
                    # Calculate lag and rolling features up to current point
                    combined_df.loc[i, 'consumption_lag_1h'] = combined_df.loc[i-1, 'consumption'] if i >= 1 else 0
                    combined_df.loc[i, 'consumption_lag_2h'] = combined_df.loc[i-2, 'consumption'] if i >= 2 else 0
                    combined_df.loc[i, 'consumption_lag_24h'] = combined_df.loc[i-24, 'consumption'] if i >= 24 else combined_df.loc[max(0, i-24):i, 'consumption'].mean()
                    
                    # Rolling averages
                    combined_df.loc[i, 'consumption_rolling_3h'] = combined_df.loc[max(0, i-3):i, 'consumption'].mean()
                    combined_df.loc[i, 'consumption_rolling_6h'] = combined_df.loc[max(0, i-6):i, 'consumption'].mean()
                    combined_df.loc[i, 'consumption_rolling_24h'] = combined_df.loc[max(0, i-24):i, 'consumption'].mean()
                    
                    # Rolling statistics
                    combined_df.loc[i, 'consumption_rolling_std_6h'] = combined_df.loc[max(0, i-6):i, 'consumption'].std() if i >= 6 else 0
                    combined_df.loc[i, 'consumption_rolling_min_24h'] = combined_df.loc[max(0, i-24):i, 'consumption'].min()
                    combined_df.loc[i, 'consumption_rolling_max_24h'] = combined_df.loc[max(0, i-24):i, 'consumption'].max()
                    
                    # Interaction
                    combined_df.loc[i, 'hour_weekend_interaction'] = combined_df.loc[i, 'hour'] * combined_df.loc[i, 'is_weekend']
                    
                    # Get features for this timestep
                    X_current = combined_df.loc[i:i, feature_columns].values
                    X_current = np.nan_to_num(X_current, 0)  # Replace any NaN with 0
                    
                    # Scale and predict
                    X_scaled = scaler.transform(X_current)
                    pred = model.predict(X_scaled)[0]
                    pred = max(pred, 0)  # Ensure non-negative
                    
                    # Store prediction back into dataframe for next iteration's lag features
                    combined_df.loc[i, 'consumption'] = pred
                    predictions.append(pred)
                
                predictions = np.array(predictions)
        
        # Ensure non-negative and reasonable predictions
        predictions = np.maximum(predictions, 0)
        
        # Add validation to catch unrealistic values
        max_reasonable = 10.0
        if np.max(predictions) > max_reasonable:
            logger.warning(f"Capping unrealistic prediction for {device_name}: max={np.max(predictions):.2f} kWh")
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
    
    def train_all_models(self, days: int = 30) -> Dict:
        """
        Train models for all devices with advanced ML
        
        Args:
            days: Number of days of historical data to use (default: 30)
        
        Returns:
            Summary of training results
        """
        result = self.db.execute(text("SELECT DISTINCT name FROM devices"))
        devices = [row[0] for row in result.fetchall()]
        
        results = []
        successful = 0
        failed = 0
        
        logger.info(f"Starting training for {len(devices)} devices with {days} days of data...")
        
        for device_name in devices:
            train_result = self.train_model(device_name, days)
            results.append(train_result)
            
            if train_result.get("success"):
                successful += 1
            else:
                failed += 1
        
        logger.info(f"Training complete: {successful} successful, {failed} failed")
        
        return {
            "success": True,
            "total_devices": len(devices),
            "successful": successful,
            "failed": failed,
            "results": results,
            "timestamp": datetime.now().isoformat()
        }
