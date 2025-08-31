"""
Usage tracking service for managing free trials and premium features.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
from flask import session
import pytz

logger = logging.getLogger(__name__)

class UsageService:
    def __init__(self):
        self.free_trial_limit = 5
        # Use /tmp for usage data since the filesystem is read-only
        self.usage_file = '/tmp/usage_data.json'
        self._ensure_usage_file()
    
    def _ensure_usage_file(self):
        """Ensure usage data file exists."""
        if not os.path.exists(self.usage_file):
            try:
                with open(self.usage_file, 'w') as f:
                    json.dump({}, f)
                logger.info(f"Created usage data file: {self.usage_file}")
            except Exception as e:
                logger.error(f"Failed to create usage file: {e}")
    
    def _load_usage_data(self) -> Dict:
        """Load usage data from file."""
        try:
            with open(self.usage_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load usage data: {e}")
            return {}
    
    def _save_usage_data(self, data: Dict):
        """Save usage data to file."""
        try:
            with open(self.usage_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save usage data: {e}")
    
    def get_session_id(self) -> str:
        """Get or create session ID."""
        if 'session_id' not in session:
            import uuid
            session['session_id'] = str(uuid.uuid4())
        return session['session_id']
    
    def _get_ist_date(self) -> str:
        """Get current date in IST timezone (YYYY-MM-DD format)."""
        ist = pytz.timezone('Asia/Kolkata')
        now_ist = datetime.now(ist)
        return now_ist.strftime('%Y-%m-%d')
    
    def _should_reset_daily_usage(self, user_data: Dict) -> bool:
        """Check if daily usage should be reset based on IST timezone."""
        if user_data.get('is_premium', False):
            return False  # Premium users don't have daily limits
        
        current_date = self._get_ist_date()
        last_reset_date = user_data.get('last_reset_date', '')
        
        return current_date != last_reset_date
    
    def _reset_daily_usage(self, user_data: Dict) -> Dict:
        """Reset daily usage counters."""
        current_date = self._get_ist_date()
        user_data['analysis_count'] = 0
        user_data['generation_count'] = 0
        user_data['last_reset_date'] = current_date
        return user_data

    def get_usage_info(self, session_id: Optional[str] = None) -> Dict:
        """Get usage information for a session."""
        if not session_id:
            session_id = self.get_session_id()
        
        usage_data = self._load_usage_data()
        user_data = usage_data.get(session_id, {
            'analysis_count': 0,
            'generation_count': 0,
            'first_use': datetime.now().isoformat(),
            'is_premium': False,
            'last_reset_date': self._get_ist_date()
        })
        
        # Check if we need to reset daily usage
        if self._should_reset_daily_usage(user_data):
            user_data = self._reset_daily_usage(user_data)
            usage_data[session_id] = user_data
            self._save_usage_data(usage_data)
        
        total_usage = user_data['analysis_count'] + user_data['generation_count']
        remaining_free = max(0, self.free_trial_limit - total_usage)
        
        # Calculate time until next reset (12:00 AM IST)
        ist = pytz.timezone('Asia/Kolkata')
        now_ist = datetime.now(ist)
        next_reset = now_ist.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        time_until_reset = next_reset - now_ist
        
        return {
            'session_id': session_id,
            'analysis_count': user_data['analysis_count'],
            'generation_count': user_data['generation_count'],
            'total_usage': total_usage,
            'free_trial_limit': self.free_trial_limit,
            'remaining_free': remaining_free,
            'is_premium': user_data.get('is_premium', False),
            'can_use_feature': remaining_free > 0 or user_data.get('is_premium', False),
            'reset_time_hours': int(time_until_reset.total_seconds() // 3600),
            'reset_time_minutes': int((time_until_reset.total_seconds() % 3600) // 60),
            'next_reset_ist': next_reset.strftime('%Y-%m-%d %H:%M:%S IST')
        }
    
    def can_use_analysis(self, session_id: Optional[str] = None) -> Tuple[bool, str]:
        """Check if user can use analysis feature."""
        usage_info = self.get_usage_info(session_id)
        
        if usage_info['is_premium']:
            return True, "Premium user"
        
        if usage_info['remaining_free'] > 0:
            return True, f"Free trial: {usage_info['remaining_free']} uses remaining today"
        
        reset_hours = usage_info['reset_time_hours']
        reset_minutes = usage_info['reset_time_minutes']
        
        if reset_hours > 0:
            return False, f"Daily limit reached. Resets in {reset_hours}h {reset_minutes}m (12:00 AM IST) or upgrade to premium."
        else:
            return False, f"Daily limit reached. Resets in {reset_minutes}m (12:00 AM IST) or upgrade to premium."
    
    def record_analysis_usage(self, session_id: Optional[str] = None) -> bool:
        """Record analysis usage and return success."""
        if not session_id:
            session_id = self.get_session_id()
        
        can_use, message = self.can_use_analysis(session_id)
        if not can_use:
            return False
        
        usage_data = self._load_usage_data()
        
        if session_id not in usage_data:
            usage_data[session_id] = {
                'analysis_count': 0,
                'generation_count': 0,
                'first_use': datetime.now().isoformat(),
                'is_premium': False
            }
        
        usage_data[session_id]['analysis_count'] += 1
        usage_data[session_id]['last_use'] = datetime.now().isoformat()
        
        self._save_usage_data(usage_data)
        return True
    
    def record_generation_usage(self, session_id: Optional[str] = None) -> bool:
        """Record code generation usage and return success."""
        if not session_id:
            session_id = self.get_session_id()
        
        can_use, message = self.can_use_analysis(session_id)  # Same limit for both features
        if not can_use:
            return False
        
        usage_data = self._load_usage_data()
        
        if session_id not in usage_data:
            usage_data[session_id] = {
                'analysis_count': 0,
                'generation_count': 0,
                'first_use': datetime.now().isoformat(),
                'is_premium': False
            }
        
        usage_data[session_id]['generation_count'] += 1
        usage_data[session_id]['last_use'] = datetime.now().isoformat()
        
        self._save_usage_data(usage_data)
        return True
    
    def upgrade_to_premium(self, session_id: Optional[str] = None) -> bool:
        """Upgrade user to premium (placeholder for payment integration)."""
        if not session_id:
            session_id = self.get_session_id()
        
        usage_data = self._load_usage_data()
        
        if session_id not in usage_data:
            usage_data[session_id] = {
                'analysis_count': 0,
                'generation_count': 0,
                'first_use': datetime.now().isoformat(),
                'is_premium': False
            }
        
        usage_data[session_id]['is_premium'] = True
        usage_data[session_id]['premium_since'] = datetime.now().isoformat()
        
        self._save_usage_data(usage_data)
        return True
    
    def reset_free_trial(self, session_id: Optional[str] = None) -> bool:
        """Reset free trial for a session (admin function)."""
        if not session_id:
            session_id = self.get_session_id()
        
        usage_data = self._load_usage_data()
        
        if session_id in usage_data:
            usage_data[session_id]['analysis_count'] = 0
            usage_data[session_id]['generation_count'] = 0
            usage_data[session_id]['reset_date'] = datetime.now().isoformat()
            
            self._save_usage_data(usage_data)
            return True
        
        return False
    
    def get_all_usage_stats(self) -> Dict:
        """Get overall usage statistics (admin function)."""
        usage_data = self._load_usage_data()
        
        total_users = len(usage_data)
        total_analyses = sum(user.get('analysis_count', 0) for user in usage_data.values())
        total_generations = sum(user.get('generation_count', 0) for user in usage_data.values())
        premium_users = sum(1 for user in usage_data.values() if user.get('is_premium', False))
        
        return {
            'total_users': total_users,
            'total_analyses': total_analyses,
            'total_generations': total_generations,
            'premium_users': premium_users,
            'free_users': total_users - premium_users
        }

# Global service instance
usage_service = UsageService()