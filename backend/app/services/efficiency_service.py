"""
Energy Efficiency Service
Calculates efficiency scores and provides recommendations
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, List, Tuple
import logging

from models.energy import EnergyConsumption

logger = logging.getLogger(__name__)

# Average household consumption benchmarks (kWh/day)
AVERAGE_HOUSEHOLD_CONSUMPTION = {
    '24h': 30.0,  # 30 kWh per day average
    '7d': 210.0,  # 30 kWh × 7 days
    '30d': 900.0  # 30 kWh × 30 days
}

# Efficiency grade thresholds (based on percentage below/above average)
GRADE_THRESHOLDS = {
    'A+': (None, -20),      # 20%+ below average
    'A': (-20, -10),        # 10-20% below average
    'B': (-10, 0),          # 0-10% below average
    'C': (0, 15),           # 0-15% above average
    'D': (15, 30),          # 15-30% above average
    'F': (30, None)         # 30%+ above average
}

class EfficiencyService:
    """Service for calculating energy efficiency metrics"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def calculate_efficiency_score(self, days: int = 7) -> Dict:
        """
        Calculate energy efficiency score based on consumption patterns
        
        Args:
            days: Number of days to analyze (default 7)
        
        Returns:
            Dictionary with score, grade, comparison, tips, and historical data
        """
        try:
            # Get consumption data for the period
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            total_consumption = self.db.query(
                func.sum(EnergyConsumption.consumption)
            ).filter(
                EnergyConsumption.timestamp >= start_date,
                EnergyConsumption.timestamp <= end_date
            ).scalar() or 0.0
            
            # Get average daily consumption
            avg_daily = total_consumption / days if days > 0 else 0
            
            # Determine benchmark based on period
            if days <= 1:
                benchmark = AVERAGE_HOUSEHOLD_CONSUMPTION['24h']
            elif days <= 7:
                benchmark = AVERAGE_HOUSEHOLD_CONSUMPTION['7d'] / 7
            else:
                benchmark = AVERAGE_HOUSEHOLD_CONSUMPTION['30d'] / 30
            
            # Calculate percentage difference from average
            if benchmark > 0:
                percentage_diff = ((avg_daily - benchmark) / benchmark) * 100
            else:
                percentage_diff = 0
            
            # Calculate score (0-100, where 100 is best)
            # Formula: 100 - (percentage above average, capped at 50)
            score = max(0, min(100, 100 - max(0, percentage_diff)))
            
            # Determine grade
            grade = self._get_grade(percentage_diff)
            
            # Generate comparison text
            if percentage_diff <= 0:
                comparison = f"{abs(percentage_diff):.1f}% below average"
            else:
                comparison = f"{percentage_diff:.1f}% above average"
            
            # Generate tips based on score
            tips = self._generate_tips(score, grade, avg_daily, benchmark)
            
            # Get historical scores (last 7 days)
            historical_scores = self._get_historical_scores(7)
            
            return {
                "score": round(score, 1),
                "grade": grade,
                "comparison": comparison,
                "avg_daily_consumption": round(avg_daily, 2),
                "benchmark_consumption": round(benchmark, 2),
                "percentage_difference": round(percentage_diff, 1),
                "tips": tips,
                "historical_scores": historical_scores,
                "period_days": days
            }
            
        except Exception as e:
            logger.error(f"Error calculating efficiency score: {e}")
            return {
                "score": 0,
                "grade": "N/A",
                "comparison": "Insufficient data",
                "tips": ["Collect more data to calculate efficiency score"],
                "historical_scores": []
            }
    
    def _get_grade(self, percentage_diff: float) -> str:
        """Determine efficiency grade based on percentage difference"""
        for grade, (lower, upper) in GRADE_THRESHOLDS.items():
            if lower is None and percentage_diff < upper:
                return grade
            elif upper is None and percentage_diff >= lower:
                return grade
            elif lower is not None and upper is not None:
                if lower <= percentage_diff < upper:
                    return grade
        return 'C'  # Default grade
    
    def _generate_tips(self, score: float, grade: str, avg_daily: float, benchmark: float) -> List[str]:
        """Generate personalized efficiency tips"""
        tips = []
        
        if score >= 95:
            tips.append("🌟 Excellent! You're a energy efficiency champion!")
            tips.append("Keep up the great work maintaining low consumption")
        elif score >= 85:
            tips.append("👍 Great job! Your consumption is well below average")
            tips.append("Consider sharing your energy-saving practices")
        elif score >= 75:
            tips.append("✅ Good! You're doing better than average")
            tips.append("Look for opportunities to reduce peak-hour usage")
        elif score >= 65:
            tips.append("⚠️ Average consumption - room for improvement")
            tips.append("Turn off devices when not in use")
            tips.append("Consider energy-efficient appliances")
        else:
            tips.append("🔴 High consumption detected - action needed")
            tips.append("Identify always-on devices and turn them off")
            tips.append("Shift high-power usage to off-peak hours")
            tips.append("Check for inefficient or faulty appliances")
        
        # Add specific tips based on consumption patterns
        if avg_daily > benchmark * 1.5:
            tips.append("💡 Your consumption is significantly high - consider an energy audit")
        
        return tips
    
    def _get_historical_scores(self, days: int) -> List[Dict]:
        """Get historical efficiency scores for trend analysis"""
        historical = []
        
        try:
            for i in range(days, 0, -1):
                date = datetime.now() - timedelta(days=i)
                day_start = date.replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = day_start + timedelta(days=1)
                
                daily_consumption = self.db.query(
                    func.sum(EnergyConsumption.consumption)
                ).filter(
                    EnergyConsumption.timestamp >= day_start,
                    EnergyConsumption.timestamp < day_end
                ).scalar() or 0.0
                
                benchmark = AVERAGE_HOUSEHOLD_CONSUMPTION['24h']
                percentage_diff = ((daily_consumption - benchmark) / benchmark) * 100 if benchmark > 0 else 0
                score = max(0, min(100, 100 - max(0, percentage_diff)))
                
                historical.append({
                    "date": day_start.strftime('%Y-%m-%d'),
                    "score": round(score, 1),
                    "consumption": round(daily_consumption, 2)
                })
        
        except Exception as e:
            logger.error(f"Error getting historical scores: {e}")
        
        return historical
    
    def get_efficiency_insights(self) -> Dict:
        """Get additional efficiency insights"""
        try:
            # Get device-level efficiency
            device_efficiency = self._analyze_device_efficiency()
            
            # Get time-based efficiency
            time_efficiency = self._analyze_time_efficiency()
            
            return {
                "device_efficiency": device_efficiency,
                "time_efficiency": time_efficiency
            }
            
        except Exception as e:
            logger.error(f"Error getting efficiency insights: {e}")
            return {}
    
    def _analyze_device_efficiency(self) -> List[Dict]:
        """Analyze efficiency per device"""
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=7)
            
            device_data = self.db.query(
                EnergyConsumption.device_name,
                func.sum(EnergyConsumption.consumption).label('total'),
                func.avg(EnergyConsumption.consumption).label('average'),
                func.count(EnergyConsumption.id).label('count')
            ).filter(
                EnergyConsumption.timestamp >= start_date
            ).group_by(
                EnergyConsumption.device_name
            ).all()
            
            result = []
            for device in device_data:
                result.append({
                    "device": device.device_name,
                    "total_consumption": round(device.total, 2),
                    "average_consumption": round(device.average, 2),
                    "reading_count": device.count
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing device efficiency: {e}")
            return []
    
    def _analyze_time_efficiency(self) -> Dict:
        """Analyze consumption by time of day"""
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=7)
            
            # Get hourly consumption
            hourly_data = self.db.query(
                func.extract('hour', EnergyConsumption.timestamp).label('hour'),
                func.avg(EnergyConsumption.consumption).label('avg_consumption')
            ).filter(
                EnergyConsumption.timestamp >= start_date
            ).group_by(
                func.extract('hour', EnergyConsumption.timestamp)
            ).order_by('hour').all()
            
            hourly_avg = {int(row.hour): round(row.avg_consumption, 2) for row in hourly_data}
            
            # Identify peak and off-peak hours
            if hourly_avg:
                peak_hour = max(hourly_avg, key=hourly_avg.get)
                off_peak_hour = min(hourly_avg, key=hourly_avg.get)
            else:
                peak_hour = 19
                off_peak_hour = 3
            
            return {
                "hourly_average": hourly_avg,
                "peak_hour": peak_hour,
                "off_peak_hour": off_peak_hour
            }
            
        except Exception as e:
            logger.error(f"Error analyzing time efficiency: {e}")
            return {}
