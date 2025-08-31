"""
Flask application factory and configuration.
"""

from flask import Flask, request, g
from flask_cors import CORS
from dotenv import load_dotenv
import os
import logging
import secrets

# Load environment variables
load_dotenv()

def create_app():
    """Create and configure the Flask application."""
    # Configure Flask to serve React static files
    static_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'static')
    app = Flask(__name__, static_folder=static_folder, static_url_path='')
    
    # Enhanced security configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', secrets.token_hex(32))
    app.config['DEBUG'] = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    # Session configuration for security and isolation
    app.config['SESSION_COOKIE_SECURE'] = os.getenv('SESSION_COOKIE_SECURE', 'False').lower() == 'true'
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['PERMANENT_SESSION_LIFETIME'] = 3600  # 1 hour
    app.config['SESSION_COOKIE_NAME'] = 'code_editor_session'
    
    # Security headers configuration
    app.config['SECURITY_HEADERS'] = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
    
    # Request size limits
    app.config['MAX_CONTENT_LENGTH'] = 1024 * 1024  # 1MB max request size
    
    # CORS configuration with enhanced security
    cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://localhost:3001').split(',')
    CORS(app, 
         origins=cors_origins, 
         supports_credentials=True,
         allow_headers=['Content-Type', 'Authorization'],
         methods=['GET', 'POST', 'OPTIONS'])
    
    # Configure logging
    if not app.debug:
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s %(levelname)s %(name)s: %(message)s'
        )
    
    # Security middleware
    from app.middleware.rate_limiter import add_rate_limit_headers
    
    @app.before_request
    def before_request():
        """Security checks before each request."""
        # Log request for security monitoring
        if not request.endpoint or request.endpoint != 'static':
            app.logger.info(f"Request: {request.method} {request.path} from {request.remote_addr}")
        
        # Check request size
        if request.content_length and request.content_length > app.config['MAX_CONTENT_LENGTH']:
            app.logger.warning(f"Request too large: {request.content_length} bytes from {request.remote_addr}")
            return {
                'success': False,
                'error': {
                    'type': 'request_too_large',
                    'message': 'Request entity too large',
                    'details': f'Maximum request size is {app.config["MAX_CONTENT_LENGTH"]} bytes'
                }
            }, 413
        
        # Validate Content-Type for POST requests
        if request.method == 'POST' and request.endpoint and 'api' in request.endpoint:
            if not request.is_json:
                app.logger.warning(f"Invalid Content-Type from {request.remote_addr}")
                return {
                    'success': False,
                    'error': {
                        'type': 'invalid_request',
                        'message': 'Content-Type must be application/json',
                        'details': 'Request must have Content-Type: application/json header'
                    }
                }, 400
    
    @app.after_request
    def after_request(response):
        """Add security headers and rate limit info to all responses."""
        # Add security headers
        for header, value in app.config['SECURITY_HEADERS'].items():
            response.headers[header] = value
        
        # Add rate limit headers
        response = add_rate_limit_headers(response)
        
        # Log response for security monitoring
        if response.status_code >= 400:
            app.logger.warning(f"Error response: {response.status_code} for {request.method} {request.path}")
        
        return response
    
    @app.errorhandler(413)
    def request_entity_too_large(error):
        """Handle request too large errors."""
        return {
            'success': False,
            'error': {
                'type': 'request_too_large',
                'message': 'Request entity too large',
                'details': f'Maximum request size is {app.config["MAX_CONTENT_LENGTH"]} bytes'
            }
        }, 413
    
    @app.errorhandler(429)
    def rate_limit_exceeded(error):
        """Handle rate limit exceeded errors."""
        return {
            'success': False,
            'error': {
                'type': 'rate_limit_error',
                'message': 'Rate limit exceeded',
                'details': 'Too many requests. Please slow down.'
            }
        }, 429
    
    @app.errorhandler(500)
    def internal_server_error(error):
        """Handle internal server errors."""
        app.logger.error(f"Internal server error: {error}")
        return {
            'success': False,
            'error': {
                'type': 'server_error',
                'message': 'Internal server error',
                'details': 'An unexpected error occurred'
            }
        }, 500
    
    # Register blueprints
    from app.routes.api import api_bp
    from app.routes.temp_payments import temp_payments_bp
    from app.routes.ai_admin import ai_admin_bp
    
    app.register_blueprint(api_bp, url_prefix='/api')
    app.register_blueprint(temp_payments_bp, url_prefix='/api/payments')
    app.register_blueprint(ai_admin_bp, url_prefix='/api')
    
    # Initialize and register auth routes
    try:
        from app.services.auth_service import auth_service
        from app.routes.auth import auth_bp
        
        # Initialize auth service with app config
        auth_service.initialize(app)
        
        app.register_blueprint(auth_bp, url_prefix='/api/auth')
        app.logger.info("Auth routes registered successfully")
    except ImportError as e:
        app.logger.warning(f"Could not import auth routes: {e}")
    except Exception as e:
        app.logger.error(f"Error initializing auth service: {e}")
    
    # Initialize database
    try:
        from app.database.connection import init_database
        init_database()
        app.logger.info("Database initialized successfully")
    except Exception as e:
        app.logger.error(f"Error initializing database: {e}")
    
    # Register payments and admin routes
    try:
        from app.routes.payments import payments_bp
        from app.routes.admin import admin_bp
        app.register_blueprint(payments_bp, url_prefix='/api/payments')
        app.register_blueprint(admin_bp, url_prefix='/api/admin')
        app.logger.info("Payment and admin routes registered successfully")
    except Exception as e:
        app.logger.error(f"Error registering payment/admin routes: {e}")
    
    # Health check endpoint
    @app.route('/health')
    def health_check():
        return {
            'status': 'healthy', 
            'service': 'multi-language-code-editor-backend',
            'version': '1.0.0',
            'security': 'enabled'
        }
    
    # Serve React app for all non-API routes
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_react_app(path):
        """Serve React app for all non-API routes."""
        # Don't serve React app for API routes
        if path.startswith('api/'):
            return {'error': 'API endpoint not found'}, 404
        
        # Serve static files directly
        if path and '.' in path:
            return app.send_static_file(path)
        
        # Serve React app's index.html for all other routes
        try:
            return app.send_static_file('index.html')
        except FileNotFoundError:
            return {
                'error': 'React app not built. Please run: cd frontend && npm run build'
            }, 404
    
    return app