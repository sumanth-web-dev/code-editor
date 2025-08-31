from app.database.connection import get_db_connection

class SubscriptionRepository:
    @staticmethod
    def get_status_counts():
        # Example: Count subscription statuses from subscriptions table
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT status, COUNT(*) as count FROM subscriptions GROUP BY status")
            rows = cursor.fetchall()
            return {row['status']: row['count'] for row in rows}
