from app.database.connection import get_db_connection

class ActivityRepository:
    @staticmethod
    def get_recent_activity(limit=10):
        # Example: Get recent activities from activity_log table
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT description, timestamp FROM activity_log ORDER BY timestamp DESC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            return [{'description': row['description'], 'timestamp': row['timestamp']} for row in rows]
