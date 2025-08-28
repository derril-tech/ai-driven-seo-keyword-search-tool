import asyncio
import logging
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from dataclasses import dataclass
import json
from scipy import stats
from scipy.signal import find_peaks
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.stattools import adfuller
from statsmodels.tsa.arima.model import ARIMA
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

@dataclass
class TrendData:
    keyword: str
    search_volume: List[int]
    dates: List[datetime]
    trend_direction: str  # 'increasing', 'decreasing', 'stable', 'seasonal'
    trend_strength: float
    seasonality: Dict[str, Any]
    forecast: List[float]
    confidence_interval: Tuple[List[float], List[float]]
    anomalies: List[int]
    created_at: datetime

@dataclass
class SeasonalityPattern:
    period: str  # 'daily', 'weekly', 'monthly', 'yearly'
    strength: float
    peaks: List[int]
    troughs: List[int]
    pattern_description: str

class TrendAnalysisWorker:
    def __init__(self):
        self.logger = logger
        self.min_data_points = 30  # Minimum data points for trend analysis
        self.forecast_periods = 12  # Number of periods to forecast
    
    async def analyze_trends(self, keyword_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze trends for multiple keywords"""
        try:
            self.logger.info(f"Starting trend analysis for {len(keyword_data)} keywords")
            
            results = []
            for keyword_info in keyword_data:
                keyword = keyword_info.get('keyword', '')
                search_volume_data = keyword_info.get('search_volume_data', [])
                
                if len(search_volume_data) >= self.min_data_points:
                    trend_result = await self._analyze_single_trend(keyword, search_volume_data)
                    results.append(trend_result)
                else:
                    self.logger.warning(f"Insufficient data for {keyword}: {len(search_volume_data)} points")
            
            # Aggregate results
            summary = await self._generate_trend_summary(results)
            
            return {
                'trends': results,
                'summary': summary,
                'analysis_date': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Error in trend analysis: {e}")
            raise
    
    async def _analyze_single_trend(self, keyword: str, search_volume_data: List[Dict[str, Any]]) -> TrendData:
        """Analyze trend for a single keyword"""
        try:
            # Prepare data
            df = await self._prepare_trend_data(search_volume_data)
            
            if df.empty:
                raise ValueError(f"No valid data for keyword: {keyword}")
            
            # Detect trend direction and strength
            trend_direction, trend_strength = await self._detect_trend_direction(df)
            
            # Detect seasonality
            seasonality = await self._detect_seasonality(df)
            
            # Generate forecast
            forecast, confidence_interval = await self._generate_forecast(df)
            
            # Detect anomalies
            anomalies = await self._detect_anomalies(df)
            
            trend_data = TrendData(
                keyword=keyword,
                search_volume=df['search_volume'].tolist(),
                dates=df['date'].tolist(),
                trend_direction=trend_direction,
                trend_strength=trend_strength,
                seasonality=seasonality,
                forecast=forecast,
                confidence_interval=confidence_interval,
                anomalies=anomalies,
                created_at=datetime.utcnow()
            )
            
            return trend_data
            
        except Exception as e:
            self.logger.error(f"Error analyzing trend for {keyword}: {e}")
            raise
    
    async def _prepare_trend_data(self, search_volume_data: List[Dict[str, Any]]) -> pd.DataFrame:
        """Prepare data for trend analysis"""
        try:
            # Convert to DataFrame
            df = pd.DataFrame(search_volume_data)
            
            # Ensure required columns
            if 'date' not in df.columns or 'search_volume' not in df.columns:
                raise ValueError("Data must contain 'date' and 'search_volume' columns")
            
            # Convert date column
            df['date'] = pd.to_datetime(df['date'])
            
            # Sort by date
            df = df.sort_values('date').reset_index(drop=True)
            
            # Handle missing values
            df['search_volume'] = df['search_volume'].fillna(method='ffill').fillna(method='bfill')
            
            # Remove outliers using IQR method
            Q1 = df['search_volume'].quantile(0.25)
            Q3 = df['search_volume'].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            
            df = df[(df['search_volume'] >= lower_bound) & (df['search_volume'] <= upper_bound)]
            
            return df
            
        except Exception as e:
            self.logger.error(f"Error preparing trend data: {e}")
            raise
    
    async def _detect_trend_direction(self, df: pd.DataFrame) -> Tuple[str, float]:
        """Detect trend direction and strength"""
        try:
            # Linear regression for trend
            X = np.arange(len(df)).reshape(-1, 1)
            y = df['search_volume'].values
            
            reg = LinearRegression()
            reg.fit(X, y)
            
            slope = reg.coef_[0]
            r_squared = reg.score(X, y)
            
            # Determine trend direction
            if abs(slope) < 0.1:  # Small slope threshold
                direction = 'stable'
            elif slope > 0:
                direction = 'increasing'
            else:
                direction = 'decreasing'
            
            # Calculate trend strength (0-1)
            trend_strength = min(abs(r_squared), 1.0)
            
            return direction, trend_strength
            
        except Exception as e:
            self.logger.error(f"Error detecting trend direction: {e}")
            return 'stable', 0.0
    
    async def _detect_seasonality(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Detect seasonality patterns"""
        try:
            seasonality_result = {
                'has_seasonality': False,
                'patterns': [],
                'strength': 0.0
            }
            
            # Check for different seasonality periods
            periods = {
                'weekly': 7,
                'monthly': 30,
                'quarterly': 90,
                'yearly': 365
            }
            
            best_pattern = None
            max_strength = 0.0
            
            for period_name, period_days in periods.items():
                if len(df) >= period_days * 2:  # Need at least 2 periods
                    pattern = await self._analyze_seasonality_period(df, period_name, period_days)
                    if pattern and pattern.strength > max_strength:
                        max_strength = pattern.strength
                        best_pattern = pattern
            
            if best_pattern and best_pattern.strength > 0.3:  # Threshold for seasonality
                seasonality_result['has_seasonality'] = True
                seasonality_result['patterns'] = [{
                    'period': best_pattern.period,
                    'strength': best_pattern.strength,
                    'peaks': best_pattern.peaks,
                    'troughs': best_pattern.troughs,
                    'description': best_pattern.pattern_description
                }]
                seasonality_result['strength'] = best_pattern.strength
            
            return seasonality_result
            
        except Exception as e:
            self.logger.error(f"Error detecting seasonality: {e}")
            return {'has_seasonality': False, 'patterns': [], 'strength': 0.0}
    
    async def _analyze_seasonality_period(self, df: pd.DataFrame, period_name: str, period_days: int) -> Optional[SeasonalityPattern]:
        """Analyze seasonality for a specific period"""
        try:
            # Resample data to daily frequency if needed
            df_daily = df.set_index('date').resample('D').mean().fillna(method='ffill')
            
            # Calculate seasonal decomposition
            if len(df_daily) >= period_days * 2:
                decomposition = seasonal_decompose(
                    df_daily['search_volume'], 
                    period=period_days, 
                    extrapolate_trend='freq'
                )
                
                # Calculate seasonality strength
                seasonal_strength = np.std(decomposition.seasonal) / np.std(df_daily['search_volume'])
                
                if seasonal_strength > 0.1:  # Minimum threshold
                    # Find peaks and troughs
                    seasonal_values = decomposition.seasonal.dropna()
                    peaks, _ = find_peaks(seasonal_values.values, height=seasonal_values.mean())
                    troughs, _ = find_peaks(-seasonal_values.values, height=-seasonal_values.mean())
                    
                    # Generate pattern description
                    description = await self._generate_seasonality_description(
                        seasonal_values, peaks, troughs, period_name
                    )
                    
                    return SeasonalityPattern(
                        period=period_name,
                        strength=seasonal_strength,
                        peaks=peaks.tolist(),
                        troughs=troughs.tolist(),
                        pattern_description=description
                    )
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error analyzing seasonality period {period_name}: {e}")
            return None
    
    async def _generate_seasonality_description(self, seasonal_values: pd.Series, 
                                              peaks: np.ndarray, 
                                              troughs: np.ndarray, 
                                              period_name: str) -> str:
        """Generate description of seasonality pattern"""
        try:
            if len(peaks) == 0 and len(troughs) == 0:
                return f"No clear {period_name} pattern detected"
            
            # Calculate average seasonal values
            avg_seasonal = seasonal_values.mean()
            max_seasonal = seasonal_values.max()
            min_seasonal = seasonal_values.min()
            
            # Determine pattern type
            if len(peaks) == 1 and len(troughs) == 1:
                pattern_type = "single peak and trough"
            elif len(peaks) > 1:
                pattern_type = f"multiple peaks ({len(peaks)})"
            else:
                pattern_type = "irregular pattern"
            
            # Calculate variation
            variation = (max_seasonal - min_seasonal) / avg_seasonal * 100
            
            description = f"{period_name.capitalize()} pattern with {pattern_type}. "
            description += f"Variation: {variation:.1f}% from average. "
            
            if variation > 50:
                description += "Strong seasonal variation."
            elif variation > 20:
                description += "Moderate seasonal variation."
            else:
                description += "Weak seasonal variation."
            
            return description
            
        except Exception as e:
            self.logger.error(f"Error generating seasonality description: {e}")
            return f"{period_name.capitalize()} pattern detected"
    
    async def _generate_forecast(self, df: pd.DataFrame) -> Tuple[List[float], Tuple[List[float], List[float]]]:
        """Generate forecast for the time series"""
        try:
            # Prepare data for forecasting
            ts_data = df['search_volume'].values
            
            # Try different forecasting methods
            forecasts = []
            confidence_intervals = []
            
            # Method 1: Simple linear trend
            linear_forecast, linear_ci = await self._linear_forecast(ts_data)
            forecasts.append(('linear', linear_forecast))
            confidence_intervals.append(('linear', linear_ci))
            
            # Method 2: ARIMA if enough data
            if len(ts_data) >= 50:
                try:
                    arima_forecast, arima_ci = await self._arima_forecast(ts_data)
                    forecasts.append(('arima', arima_forecast))
                    confidence_intervals.append(('arima', arima_ci))
                except Exception as e:
                    self.logger.warning(f"ARIMA forecast failed: {e}")
            
            # Method 3: Polynomial trend
            poly_forecast, poly_ci = await self._polynomial_forecast(ts_data)
            forecasts.append(('polynomial', poly_forecast))
            confidence_intervals.append(('polynomial', poly_ci))
            
            # Select best forecast (simplest approach: use linear)
            best_forecast = linear_forecast
            best_ci = linear_ci
            
            return best_forecast, best_ci
            
        except Exception as e:
            self.logger.error(f"Error generating forecast: {e}")
            # Return simple extrapolation
            last_values = df['search_volume'].tail(5).values
            avg_growth = np.mean(np.diff(last_values))
            forecast = [last_values[-1] + avg_growth * (i + 1) for i in range(self.forecast_periods)]
            ci_lower = [f * 0.8 for f in forecast]
            ci_upper = [f * 1.2 for f in forecast]
            return forecast, (ci_lower, ci_upper)
    
    async def _linear_forecast(self, ts_data: np.ndarray) -> Tuple[List[float], Tuple[List[float], List[float]]]:
        """Generate linear trend forecast"""
        try:
            X = np.arange(len(ts_data)).reshape(-1, 1)
            y = ts_data
            
            reg = LinearRegression()
            reg.fit(X, y)
            
            # Generate forecast
            future_X = np.arange(len(ts_data), len(ts_data) + self.forecast_periods).reshape(-1, 1)
            forecast = reg.predict(future_X).tolist()
            
            # Calculate confidence intervals
            residuals = y - reg.predict(X)
            std_residual = np.std(residuals)
            
            ci_lower = [f - 1.96 * std_residual for f in forecast]
            ci_upper = [f + 1.96 * std_residual for f in forecast]
            
            return forecast, (ci_lower, ci_upper)
            
        except Exception as e:
            self.logger.error(f"Error in linear forecast: {e}")
            raise
    
    async def _arima_forecast(self, ts_data: np.ndarray) -> Tuple[List[float], Tuple[List[float], List[float]]]:
        """Generate ARIMA forecast"""
        try:
            # Fit ARIMA model
            model = ARIMA(ts_data, order=(1, 1, 1))
            fitted_model = model.fit()
            
            # Generate forecast
            forecast_result = fitted_model.forecast(steps=self.forecast_periods)
            forecast = forecast_result.tolist()
            
            # Get confidence intervals
            conf_int = fitted_model.get_forecast(steps=self.forecast_periods).conf_int()
            ci_lower = conf_int.iloc[:, 0].tolist()
            ci_upper = conf_int.iloc[:, 1].tolist()
            
            return forecast, (ci_lower, ci_upper)
            
        except Exception as e:
            self.logger.error(f"Error in ARIMA forecast: {e}")
            raise
    
    async def _polynomial_forecast(self, ts_data: np.ndarray) -> Tuple[List[float], Tuple[List[float], List[float]]]:
        """Generate polynomial trend forecast"""
        try:
            X = np.arange(len(ts_data)).reshape(-1, 1)
            y = ts_data
            
            # Fit polynomial (degree 2)
            poly_features = PolynomialFeatures(degree=2)
            X_poly = poly_features.fit_transform(X)
            
            reg = LinearRegression()
            reg.fit(X_poly, y)
            
            # Generate forecast
            future_X = np.arange(len(ts_data), len(ts_data) + self.forecast_periods).reshape(-1, 1)
            future_X_poly = poly_features.transform(future_X)
            forecast = reg.predict(future_X_poly).tolist()
            
            # Calculate confidence intervals
            residuals = y - reg.predict(X_poly)
            std_residual = np.std(residuals)
            
            ci_lower = [f - 1.96 * std_residual for f in forecast]
            ci_upper = [f + 1.96 * std_residual for f in forecast]
            
            return forecast, (ci_lower, ci_upper)
            
        except Exception as e:
            self.logger.error(f"Error in polynomial forecast: {e}")
            raise
    
    async def _detect_anomalies(self, df: pd.DataFrame) -> List[int]:
        """Detect anomalies in the time series"""
        try:
            anomalies = []
            search_volume = df['search_volume'].values
            
            # Method 1: Z-score method
            z_scores = np.abs(stats.zscore(search_volume))
            z_anomalies = np.where(z_scores > 3)[0]
            
            # Method 2: IQR method
            Q1 = np.percentile(search_volume, 25)
            Q3 = np.percentile(search_volume, 75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            iqr_anomalies = np.where((search_volume < lower_bound) | (search_volume > upper_bound))[0]
            
            # Combine anomalies
            all_anomalies = np.unique(np.concatenate([z_anomalies, iqr_anomalies]))
            
            return all_anomalies.tolist()
            
        except Exception as e:
            self.logger.error(f"Error detecting anomalies: {e}")
            return []
    
    async def _generate_trend_summary(self, trend_results: List[TrendData]) -> Dict[str, Any]:
        """Generate summary of all trend analyses"""
        try:
            if not trend_results:
                return {'error': 'No trend data available'}
            
            # Count trend directions
            directions = [t.trend_direction for t in trend_results]
            direction_counts = {
                'increasing': directions.count('increasing'),
                'decreasing': directions.count('decreasing'),
                'stable': directions.count('stable'),
                'seasonal': directions.count('seasonal')
            }
            
            # Calculate average trend strength
            trend_strengths = [t.trend_strength for t in trend_results]
            avg_trend_strength = np.mean(trend_strengths)
            
            # Count seasonal patterns
            seasonal_keywords = [t for t in trend_results if t.seasonality['has_seasonality']]
            seasonal_count = len(seasonal_keywords)
            
            # Find top trending keywords
            trending_keywords = sorted(
                trend_results, 
                key=lambda x: x.trend_strength, 
                reverse=True
            )[:10]
            
            # Calculate forecast accuracy (if historical data available)
            forecast_accuracy = await self._calculate_forecast_accuracy(trend_results)
            
            summary = {
                'total_keywords': len(trend_results),
                'trend_distribution': direction_counts,
                'average_trend_strength': avg_trend_strength,
                'seasonal_keywords': seasonal_count,
                'top_trending': [
                    {
                        'keyword': t.keyword,
                        'direction': t.trend_direction,
                        'strength': t.trend_strength
                    }
                    for t in trending_keywords
                ],
                'forecast_accuracy': forecast_accuracy,
                'analysis_metadata': {
                    'analysis_date': datetime.utcnow().isoformat(),
                    'min_data_points': self.min_data_points,
                    'forecast_periods': self.forecast_periods
                }
            }
            
            return summary
            
        except Exception as e:
            self.logger.error(f"Error generating trend summary: {e}")
            return {'error': str(e)}
    
    async def _calculate_forecast_accuracy(self, trend_results: List[TrendData]) -> Dict[str, float]:
        """Calculate forecast accuracy if historical data is available"""
        try:
            # This would require historical forecast data to compare with actual values
            # For now, return placeholder metrics
            return {
                'mae': 0.0,  # Mean Absolute Error
                'rmse': 0.0,  # Root Mean Square Error
                'mape': 0.0   # Mean Absolute Percentage Error
            }
            
        except Exception as e:
            self.logger.error(f"Error calculating forecast accuracy: {e}")
            return {'mae': 0.0, 'rmse': 0.0, 'mape': 0.0}
    
    async def get_seasonal_keywords(self, trend_results: List[TrendData]) -> List[Dict[str, Any]]:
        """Get keywords with strong seasonal patterns"""
        try:
            seasonal_keywords = []
            
            for trend in trend_results:
                if trend.seasonality['has_seasonality'] and trend.seasonality['strength'] > 0.5:
                    seasonal_keywords.append({
                        'keyword': trend.keyword,
                        'seasonality_strength': trend.seasonality['strength'],
                        'patterns': trend.seasonality['patterns'],
                        'trend_direction': trend.trend_direction,
                        'trend_strength': trend.trend_strength
                    })
            
            # Sort by seasonality strength
            seasonal_keywords.sort(key=lambda x: x['seasonality_strength'], reverse=True)
            
            return seasonal_keywords
            
        except Exception as e:
            self.logger.error(f"Error getting seasonal keywords: {e}")
            return []
    
    async def get_trending_keywords(self, trend_results: List[TrendData], 
                                  direction: str = 'increasing',
                                  min_strength: float = 0.5) -> List[Dict[str, Any]]:
        """Get keywords with strong trends in specified direction"""
        try:
            trending_keywords = []
            
            for trend in trend_results:
                if (trend.trend_direction == direction and 
                    trend.trend_strength >= min_strength):
                    trending_keywords.append({
                        'keyword': trend.keyword,
                        'trend_direction': trend.trend_direction,
                        'trend_strength': trend.trend_strength,
                        'forecast': trend.forecast[:3],  # Next 3 periods
                        'seasonality': trend.seasonality['has_seasonality']
                    })
            
            # Sort by trend strength
            trending_keywords.sort(key=lambda x: x['trend_strength'], reverse=True)
            
            return trending_keywords
            
        except Exception as e:
            self.logger.error(f"Error getting trending keywords: {e}")
            return []
