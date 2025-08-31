"""
Rate limiting middleware for the Flask application.
"""

import time
import logging
from collections import defaultdict, deque
from functools import wraps
from flask import request, jsonify, session, g
from typing import Dict, Tuple, Optional

logger = logging.getLogger(__name__)

class RateLimiter:
    """Rate limiter using sliding window algorithm."""
    
    def __init__(self):
        """Initialize the rate limiter."""
        # Store request timestamps for each client
        self.requests = defaultdict(deque)
        # Store blocked clients and their unblock time
        self.blocked_clients = {}
        # Cleanup interval
        self.last_cleanup = time.time()
        self.cleanup_interval = 300  # 5 minutes
    
    def _get_client_id(self) -> str:
        """Get unique client identifier."""
        # Use session ID if available, otherwise fall back to IP
        if 'session_id' in session:
            return f"session_{session['session_id']}"
        
        # Get real IP address (considering proxies)
        if request.headers.get('X-Forwarded-For'):
            ip = request.headers.get('X-Forwarded-For').split(',')[0].strip()
        elif request.headers.get('X-Real-IP'):
            ip = request.headers.get('X-Real-IP')
        else:
            ip = request.remote_addr
        
        return f"ip_{ip}"
    
    def _cleanup_old_requests(self):
        """Clean up old request records to prevent memory leaks."""
        current_time = time.time()
        
        # Only cleanup every cleanup_interval seconds
        if current_time - self.last_cleanup < self.cleanup_interval:
            return
        
        self.last_cleanup = current_time
        
        # Remove requests older than 1 hour
        cutoff_time = current_time - 3600
        
        for client_id in list(self.requests.keys()):
            request_times = self.requests[client_id]
            
            # Remove old timestamps
            while request_times and request_times[0] < cutoff_time:
                request_times.popleft()
            
            # Remove empty deques
            if not request_times:
                del self.requests[client_id]
        
        # Clean up expired blocks
        for client_id in list(self.blocked_clients.keys()):
            if current_time > self.blocked_clients[client_id]:
                del self.blocked_clients[client_id]
                logger.info(f"Unblocked client: {client_id}")
    
    def is_rate_limited(self, client_id: str, limit: int, window: int) -> Tuple[bool, Optional[int]]:
        """
        Check if client is rate limited.
        
        Args:
            client_id: Unique client identifier
            limit: Maximum requests allowed
            window: Time window in seconds
            
        Returns:
            Tuple of (is_limited, retry_after_seconds)
        """
        current_time = time.time()
        
        # Check if client is currently blocked
        if client_id in self.blocked_clients:
            if current_time < self.blocked_clients[client_id]:
                retry_after = int(self.blocked_clients[client_id] - current_time)
                return True, retry_after
            else:
                # Block expired, remove it
                del self.blocked_clients[client_id]
        
        # Clean up old requests periodically
        self._cleanup_old_requests()
        
        # Get request history for this client
        request_times = self.requests[client_id]
        
        # Remove requests outside the current window
        window_start = current_time - window
        while request_times and request_times[0] < window_start:
            request_times.popleft()
        
        # Check if limit is exceeded
        if len(request_times) >= limit:
            # Block client for the remaining window time
            block_until = current_time + window
            self.blocked_clients[client_id] = block_until
            
            logger.warning(f"Rate limit exceeded for client {client_id}: {len(request_times)} requests in {window}s")
            
            return True, window
        
        # Record this request
        request_times.append(current_time)
        
        return False, None
    
    def get_rate_limit_info(self, client_id: str, limit: int, window: int) -> Dict:
        """
        Get rate limit information for a client.
        
        Args:
            client_id: Unique client identifier
            limit: Maximum requests allowed
            window: Time window in seconds
            
        Returns:
            Dictionary with rate limit info
        """
        current_time = time.time()
        request_times = self.requests[client_id]
        
        # Count requests in current window
        window_start = current_time - window
        recent_requests = sum(1 for t in request_times if t >= window_start)
        
        remaining = max(0, limit - recent_requests)
        
        # Calculate reset time (when oldest request in window expires)
        reset_time = None
        if request_times:
            oldest_in_window = next((t for t in request_times if t >= window_start), None)
            if oldest_in_window:
                reset_time = int(oldest_in_window + window)
        
        return {
            'limit': limit,
            'remaining': remaining,
            'reset': reset_time,
            'window': window
        }

# Global rate limiter instance
rate_limiter = RateLimiter()

def rate_limit(requests_per_minute: int = 60, requests_per_hour: int = 1000):
    """
    Rate limiting decorator.
    
    Args:
        requests_per_minute: Maximum requests per minute
        requests_per_hour: Maximum requests per hour
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Skip rate limiting during testing
            import os
            if os.getenv('TESTING') == 'true' or os.getenv('FLASK_ENV') == 'testing':
                return f(*args, **kwargs)
            
            client_id = rate_limiter._get_client_id()
            
            # Check minute-based rate limit
            is_limited_minute, retry_after_minute = rate_limiter.is_rate_limited(
                f"{client_id}_minute", requests_per_minute, 60
            )
            
            if is_limited_minute:
                logger.warning(f"Rate limit exceeded (per minute) for {client_id}")
                return jsonify({
                    'success': False,
                    'error': {
                        'type': 'rate_limit_error',
                        'message': 'Too many requests per minute',
                        'details': f'Maximum {requests_per_minute} requests per minute allowed',
                        'retry_after': retry_after_minute
                    }
                }), 429
            
            # Check hour-based rate limit
            is_limited_hour, retry_after_hour = rate_limiter.is_rate_limited(
                f"{client_id}_hour", requests_per_hour, 3600
            )
            
            if is_limited_hour:
                logger.warning(f"Rate limit exceeded (per hour) for {client_id}")
                return jsonify({
                    'success': False,
                    'error': {
                        'type': 'rate_limit_error',
                        'message': 'Too many requests per hour',
                        'details': f'Maximum {requests_per_hour} requests per hour allowed',
                        'retry_after': retry_after_hour
                    }
                }), 429
            
            # Add rate limit info to response headers
            minute_info = rate_limiter.get_rate_limit_info(f"{client_id}_minute", requests_per_minute, 60)
            hour_info = rate_limiter.get_rate_limit_info(f"{client_id}_hour", requests_per_hour, 3600)
            
            # Store rate limit info in g for use in after_request
            g.rate_limit_info = {
                'minute': minute_info,
                'hour': hour_info
            }
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator

def add_rate_limit_headers(response):
    """Add rate limit headers to response."""
    if hasattr(g, 'rate_limit_info'):
        info = g.rate_limit_info
        
        # Add minute-based headers
        response.headers['X-RateLimit-Limit-Minute'] = str(info['minute']['limit'])
        response.headers['X-RateLimit-Remaining-Minute'] = str(info['minute']['remaining'])
        if info['minute']['reset']:
            response.headers['X-RateLimit-Reset-Minute'] = str(info['minute']['reset'])
        
        # Add hour-based headers
        response.headers['X-RateLimit-Limit-Hour'] = str(info['hour']['limit'])
        response.headers['X-RateLimit-Remaining-Hour'] = str(info['hour']['remaining'])
        if info['hour']['reset']:
            response.headers['X-RateLimit-Reset-Hour'] = str(info['hour']['reset'])
    
    return response