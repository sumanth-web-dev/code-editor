from app.database.connection import get_db_connection

class PaymentRepository:
    @staticmethod
    def get_payment_method_stats():
        # Example: Count payment methods from payments table
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT method, COUNT(*) as count FROM payments GROUP BY method")
            rows = cursor.fetchall()
            return {row['method']: row['count'] for row in rows}
