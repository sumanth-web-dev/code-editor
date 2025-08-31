# Admin Frontend to Backend Connection Guide

This guide explains how to configure and use the admin interface to connect to the backend.

## 🚀 Quick Start

### Option 1: Use the Admin Dashboard (Recommended)
1. **Start the backend server:**
   ```bash
   cd backend
   python app.py
   ```

2. **Open the admin dashboard:**
   - Open `admin-dashboard.html` in your browser
   - Or use the PowerShell script: `.\start-admin-dev.ps1`

3. **Login with default credentials:**
   - Email: `admin@codeplatform.com`
   - Password: `admin123`

### Option 2: Use the React Frontend
1. **Start both backend and frontend:**
   ```bash
   .\start-dev.ps1
   ```

2. **Access the React app:**
   - Open http://localhost:3000
   - Navigate to admin sections (if implemented)

## 📁 File Structure

```
project-root/
├── admin-config.js          # Admin API configuration
├── admin-dashboard.html     # Standalone admin interface
├── test-admin-login.html    # Admin login testing
├── test-connection.html     # Connection diagnostics
├── start-admin-dev.ps1      # Admin development script
├── backend/
│   ├── .env                 # Backend environment config
│   └── app.py              # Flask application
└── frontend/
    ├── .env                # Frontend environment config
    └── src/services/api.ts # API service configuration
```

## ⚙️ Configuration Details

### Backend Configuration (`backend/.env`)
```env
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY="12jsindx"
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001,file://
EXECUTION_TIMEOUT=30
MAX_MEMORY_MB=128
```

### Frontend Configuration (`frontend/.env`)
```env
REACT_APP_API_URL=http://localhost:5000
```

### Admin Configuration (`admin-config.js`)
The admin configuration automatically detects the environment and configures the API URL:
- **Development**: Uses `http://localhost:5000`
- **Production**: Uses relative URLs for same-origin requests

## 🔌 Connection Testing

### 1. Health Check
Test if the backend is running:
```bash
curl http://localhost:5000/health
```

### 2. Admin Login Test
Use `test-admin-login.html` to test admin authentication:
- Opens in browser
- Pre-filled with default credentials
- Shows detailed response information

### 3. Connection Diagnostics
Use `test-connection.html` for comprehensive testing:
- Health endpoint testing
- Auth endpoint testing
- Admin endpoint testing
- Network error diagnostics

## 🛠️ Admin Interface Features

### Admin Dashboard (`admin-dashboard.html`)
- **User Management**: View and manage users
- **System Stats**: Monitor system performance
- **Connection Testing**: Built-in diagnostic tools
- **System Logs**: View application logs
- **Real-time Status**: Live connection monitoring

### Available Admin Endpoints
- `GET /health` - System health check
- `POST /api/auth/login` - Admin authentication
- `GET /api/admin/users` - User management
- `GET /api/admin/stats` - System statistics
- `GET /api/admin/logs` - System logs

## 🔐 Authentication

### Default Admin Account
- **Email**: `admin@codeplatform.com`
- **Password**: `admin123`

### Creating Admin Account
If the admin account doesn't exist, run:
```bash
cd backend
python setup_admin.py
```

### Token Management
- Tokens are stored in localStorage
- Automatic token refresh (if implemented)
- Secure logout clears all tokens

## 🚨 Troubleshooting

### Common Issues

#### 1. Connection Refused
**Problem**: `ECONNREFUSED` error when connecting to backend
**Solutions**:
- Ensure backend is running: `python backend/app.py`
- Check if port 5000 is available: `netstat -an | findstr :5000`
- Verify backend health: http://localhost:5000/health

#### 2. CORS Errors
**Problem**: Cross-origin request blocked
**Solutions**:
- Check `CORS_ORIGINS` in `backend/.env`
- Ensure your frontend URL is included in CORS origins
- For file:// protocol, ensure `file://` is in CORS_ORIGINS

#### 3. Authentication Failures
**Problem**: Admin login fails
**Solutions**:
- Verify admin account exists: `python backend/setup_admin.py`
- Check credentials: `admin@codeplatform.com` / `admin123`
- Test with `test-admin-login.html`

#### 4. Network Timeout
**Problem**: Requests timeout
**Solutions**:
- Increase timeout in `admin-config.js`
- Check backend performance
- Verify network connectivity

### Diagnostic Tools

#### 1. Backend Status Check
```bash
.\check-backend.ps1
```

#### 2. Connection Test
Open `test-connection.html` in browser

#### 3. Admin Login Test
Open `test-admin-login.html` in browser

#### 4. Manual API Testing
```bash
# Health check
curl http://localhost:5000/health

# Admin login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@codeplatform.com","password":"admin123"}'
```

## 🔧 Development Scripts

### Start Admin Development Environment
```bash
.\start-admin-dev.ps1
```
Options:
1. Start Backend Only
2. Start Frontend Only  
3. Start Both
4. Open Admin Dashboard
5. Test Connection

### Start Full Development Environment
```bash
.\start-dev.ps1
```
Starts both backend and frontend with admin setup.

## 📊 Monitoring

### Real-time Monitoring
The admin dashboard provides:
- Connection status indicators
- Live system statistics
- User activity monitoring
- Error tracking

### Logs
- Backend logs: Check backend console
- Frontend logs: Check browser console
- Admin logs: Available in admin dashboard

## 🔒 Security Considerations

### Development Environment
- Default credentials are for development only
- CORS is configured for local development
- Debug mode is enabled

### Production Environment
- Change default admin credentials
- Update CORS origins for production domains
- Disable debug mode
- Use HTTPS
- Implement proper session management

## 📝 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout
- `POST /api/auth/refresh` - Token refresh

### Admin Endpoints
- `GET /api/admin/users` - List all users
- `GET /api/admin/stats` - System statistics
- `GET /api/admin/logs` - System logs
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user

### System Endpoints
- `GET /health` - Health check
- `GET /api/languages` - Supported languages
- `POST /api/execute` - Execute code

## 🎯 Next Steps

1. **Customize Admin Interface**: Modify `admin-dashboard.html` for your needs
2. **Add React Admin Components**: Integrate admin features into the React app
3. **Implement Role-Based Access**: Add different admin permission levels
4. **Add Monitoring**: Implement comprehensive system monitoring
5. **Security Hardening**: Implement production security measures

## 📞 Support

If you encounter issues:
1. Check this guide's troubleshooting section
2. Use the diagnostic tools provided
3. Check backend and frontend logs
4. Test with the standalone HTML tools

---

**Happy coding! 🚀**