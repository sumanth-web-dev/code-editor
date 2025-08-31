"""
Scheduler for resetting all user daily usage counts at midnight IST.
"""

from apscheduler.schedulers.background import BackgroundScheduler
from pytz import timezone
from datetime import datetime, time as dt_time
from app.database.usage_repository import UsageRepository
import logging

logger = logging.getLogger(__name__)

def reset_usage_job():
    UsageRepository.reset_all_usage()
    logger.info(f"Daily usage reset at {datetime.now(timezone('Asia/Kolkata'))}")

scheduler = BackgroundScheduler(timezone=timezone('Asia/Kolkata'))
scheduler.add_job(
    reset_usage_job,
    'cron',
    hour=0,
    minute=0,
    id='daily_usage_reset',
    replace_existing=True
)
scheduler.start()
