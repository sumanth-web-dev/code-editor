# Multi-Language Code Editor

A web-based code editor that supports multiple programming languages with syntax highlighting, dynamic code execution, and real-time output display. Built with React (TypeScript) frontend and Flask (Python) backend.

## 🚀 Features

- **Multi-Language Support**: Python, JavaScript, Java, C, C++, C#, PHP, Ruby, Go, Rust, R, TypeScript, HTML, CSS (14 languages total)
- **Real-time Syntax Highlighting**: Monaco Editor with language-specific themes
- **Dynamic Code Execution**: Secure sandboxed execution with output display
- **🤖 AI Code Analysis**: GPT-powered code analysis with corrections, explanations, and examples
- **🎯 AI Code Generation**: Generate code from natural language prompts
- **📊 Git-style Diff Viewer**: Visual comparison of original vs corrected code
- **📝 Line-by-Line Explanations**: Detailed breakdown of code functionality
- **🎓 Real-World Examples**: Practical use cases and applications
- **⚡ Smart Code Suggestions**: Performance, security, and style improvements
- **🆓 Free Trial System**: 5 free AI analyses, upgrade to premium for unlimited access
- **Live Preview**: HTML/CSS/JavaScript preview with real-time updates
- **Interactive Input**: Support for programs requiring user input
- **Security**: Input validation, rate limiting, and sandboxed execution
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Loading Animations**: Smart loading indicators with contextual messages for all operations
- **Error Handling**: Comprehensive error reporting with line numbers
- **Performance Monitoring**: Execution time and memory usage tracking

## 🏗️ Architecture

```
┌─────────────────┐    HTTP/JSON    ┌─────────────────┐
│   React Frontend│ ◄──────────────► │  Flask Backend  │
│   (TypeScript)  │                 │    (Python)     │
└─────────────────┘                 └─────────────────┘
        │                                   │
        ├── Monaco Editor                   ├── Code Executors
        ├── Language Selector               ├── Security Layer
        ├── Output Window                   ├── Rate Limiter
        ├── Preview Window                  └── Input Validator
        └── Error Boundaries
```

## 📁 Project Structure

```
├── frontend/                 # React TypeScript frontend
│   ├── public/              # Static assets
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── CodeEditor.tsx
│   │   │   ├── LanguageSelector.tsx
│   │   │   ├── OutputWindow.tsx
│   │   │   └── PreviewWindow.tsx
│   │   ├── pages/           # Page components
│   │   ├── services/        # API services
│   │   ├── hooks/           # Custom React hooks
│   │   └── types/           # TypeScript definitions
│   ├── package.json
│   └── tsconfig.json
├── backend/                 # Flask Python backend
│   ├── app/
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic
│   │   ├── models/          # Data models
│   │   ├── executors/       # Language executors
│   │   ├── security/        # Security components
│   │   └── middleware/      # Request middleware
│   ├── tests/               # Test suite
│   ├── app.py               # Application entry point
│   └── requirements.txt     # Python dependencies
├── Dockerfile               # Production container
├── docker-compose.yml       # Container orchestration
└── README.md               # This file
```

## 🛠️ Development Setup

### Prerequisites

- **Python 3.9+** with pip
- **Node.js 16+** with npm
- **Git** for version control

### Backend Setup

1. **Clone and navigate to backend**:
   ```bash
   git clone <repository-url>
   cd multi-language-code-editor/backend
   ```

2. **Create virtual environment**:
   ```bash
   python -m venv venv
   
   # Activate (Windows)
   venv\Scripts\activate
   
   # Activate (macOS/Linux)
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   # Add your OpenAI API key for AI code analysis features
   ```

5. **Run development server**:
   ```bash
   python app.py
   ```

   Backend will be available at `http://localhost:5000`

### Frontend Setup

1. **Navigate to frontend**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npm start
   ```

   Frontend will be available at `http://localhost:3000`

## 🔧 Connectivity Troubleshooting

### "ERR_ACCESS_INVALID" or "Can't reach this page" Error

If you see connectivity errors when accessing the application:

**❌ Don't use:** `http://0.0.0.0:5000/`  
**✅ Use instead:** `http://localhost:5000/`

The `0.0.0.0` address is used by servers to listen on all interfaces, but browsers need `localhost` or `127.0.0.1`.

### Quick Connectivity Test

Run the connectivity test script:
```bash
python test_connectivity_fix.py
```

### Common Issues & Solutions

1. **Port 5000 already in use**:
   ```bash
   # Check what's using port 5000
   netstat -ano | findstr :5000    # Windows
   lsof -i :5000                   # macOS/Linux
   
   # Use a different port
   # Edit backend/app.py: change port=5000 to port=3001
   ```

2. **Backend not starting**:
   ```bash
   # Check backend logs for errors
   cd backend
   python app.py
   ```

3. **GPT Service errors**:
   - The "proxies" parameter error has been fixed
   - Make sure you have the latest code
   - Set your API keys in `.env` file

4. **Health check**:
   ```bash
   # Verify backend is running
   curl http://localhost:5000/health
   # Should return: {"status": "healthy", ...}
   ```

For detailed troubleshooting, see [CONNECTIVITY_GUIDE.md](CONNECTIVITY_GUIDE.md).

### Language Runtime Setup

For full functionality, install the following language runtimes:

- **Java**: OpenJDK 11+ (`javac` and `java` commands)
- **C++**: GCC compiler (`g++` command)
- **C#**: .NET SDK (`dotnet` command)
- **Go**: Go compiler (`go` command)
- **Rust**: Rust toolchain (`rustc` command)
- **PHP**: PHP interpreter (`php` command)
- **Ruby**: Ruby interpreter (`ruby` command)

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest -v                    # Run all tests
pytest tests/test_api.py     # Run specific test file
pytest -k "test_python"      # Run tests matching pattern
```

### Frontend Tests
```bash
cd frontend
npm test                     # Run tests in watch mode
npm test -- --coverage      # Run with coverage report
npm test -- --run           # Run once without watch
```

### Integration Tests
```bash
# Start both frontend and backend, then:
cd backend
pytest tests/test_integration.py
```

## 🚀 Production Deployment

### Docker Deployment (Recommended)

1. **Build and run with Docker Compose**:
   ```bash
   docker-compose up --build -d
   ```

2. **Configure environment variables**:
   ```bash
   # Create .env file in project root
   SECRET_KEY=your-secure-secret-key
   CORS_ORIGINS=https://yourdomain.com
   SESSION_COOKIE_SECURE=true
   ```

3. **Access application**:
   - Application: `http://localhost:5000`
   - Health check: `http://localhost:5000/health`

4. **Language Support in Docker**:
   The Docker container includes all 14 supported languages:
   - **Compiled**: C (gcc/clang), C++ (g++/clang++), Java (OpenJDK), C# (.NET), Go, Rust, TypeScript
   - **Interpreted**: Python 3.9+, JavaScript (Node.js), PHP, Ruby, R
   - **Web**: HTML5, CSS3
   
   See [DOCKER_LANGUAGES.md](DOCKER_LANGUAGES.md) for detailed language configuration.

### Manual Deployment

1. **Build frontend**:
   ```bash
   cd frontend
   npm run build
   ```

2. **Configure backend for production**:
   ```bash
   cd backend
   cp .env.production .env
   # Edit .env with production values
   ```

3. **Run with Gunicorn**:
   ```bash
   gunicorn --bind 0.0.0.0:5000 --workers 4 app:create_app()
   ```

## 🤖 AI Code Analysis Setup

### OpenAI API Configuration

1. **Get OpenAI API Key**:
   - Sign up at [OpenAI Platform](https://platform.openai.com/)
   - Navigate to API Keys section
   - Create a new API key

2. **Configure Backend**:
   ```bash
   # In backend/.env file
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

3. **Features Available**:
   - **Code Analysis**: Detects syntax, logic, style, performance, and security issues
   - **Code Corrections**: Provides corrected code with git-style diff view
   - **Line-by-Line Explanations**: Detailed breakdown of each code line
   - **Real-World Examples**: Practical applications and use cases
   - **Code Generation**: Generate code from natural language prompts
   - **Best Practices**: Suggestions for code improvement

4. **Usage Limits**:
   - **Free Trial**: 5 analyses per session
   - **Premium**: Unlimited access (placeholder for payment integration)

### AI Analysis Window Features

- **Minimizable/Maximizable**: Popup window that can be minimized while working
- **Tabbed Interface**: Switch between Code Analysis and Code Generation
- **Explanation Levels**: Choose from Short, Medium, or Long explanations
- **Visual Diff**: Git-style color-coded differences between original and corrected code
- **Apply Changes**: One-click application of corrections or generated code to editor
- **Usage Tracking**: Real-time display of remaining free uses

## 📚 API Documentation

### Authentication
- Session-based authentication with CSRF protection
- Rate limiting: 30 requests/minute, 500 requests/hour

### Endpoints

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "multi-language-code-editor-backend",
  "version": "1.0.0"
}
```

#### `GET /api/languages`
Get supported programming languages.

**Response:**
```json
{
  "success": true,
  "languages": [
    {
      "id": "python",
      "name": "Python",
      "version": "3.9",
      "file_extension": ".py"
    }
  ],
  "count": 10
}
```

#### `POST /api/execute`
Execute code in specified language.

**Request:**
```json
{
  "language": "python",
  "code": "print('Hello World')",
  "input": "optional input",
  "timeout": 30
}
```

**Response:**
```json
{
  "success": true,
  "output": "Hello World\n",
  "execution_time": 0.123,
  "timeout": false,
  "session_id": "uuid"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "type": "execution_error",
    "message": "SyntaxError: invalid syntax",
    "line": 1,
    "details": "Additional error context"
  }
}
```

#### `POST /api/analyze`
Analyze code using AI (GPT-4).

**Request:**
```json
{
  "code": "print('Hello World')",
  "language": "python",
  "explain_level": "medium"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "corrections": {
      "has_issues": false,
      "issues": [],
      "corrected_code": "print('Hello World')",
      "diff": []
    },
    "line_by_line_explanation": [
      {
        "line": 1,
        "code": "print('Hello World')",
        "explanation": "Prints the string 'Hello World' to the console"
      }
    ],
    "overall_explanation": "This is a simple Python program...",
    "real_world_example": "This type of output is commonly used..."
  },
  "usage_info": {
    "remaining_free": 4,
    "is_premium": false
  }
}
```

#### `POST /api/generate`
Generate code using AI based on natural language prompt.

**Request:**
```json
{
  "prompt": "Create a function to calculate fibonacci numbers",
  "language": "python",
  "explain_level": "medium"
}
```

**Response:**
```json
{
  "success": true,
  "generation": {
    "generated_code": "def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)",
    "explanation": "This function calculates fibonacci numbers recursively...",
    "line_by_line_explanation": [...],
    "usage_example": "fibonacci(10) returns 55",
    "best_practices": ["Use memoization for better performance"]
  },
  "usage_info": {
    "remaining_free": 3,
    "is_premium": false
  }
}
```

#### `GET /api/usage`
Get current usage information for the session.

**Response:**
```json
{
  "success": true,
  "usage_info": {
    "session_id": "uuid",
    "analysis_count": 2,
    "generation_count": 1,
    "total_usage": 3,
    "free_trial_limit": 5,
    "remaining_free": 2,
    "is_premium": false,
    "can_use_feature": true
  }
}
```

## 🔒 Security Features

- **Input Validation**: Comprehensive validation of all user inputs
- **Code Sanitization**: Removal of dangerous patterns and functions
- **Execution Sandboxing**: Isolated execution environment
- **Rate Limiting**: Per-IP and per-session request limits
- **CORS Protection**: Configurable cross-origin resource sharing
- **Security Headers**: CSP, XSS protection, and other security headers
- **Session Management**: Secure session handling with CSRF protection

## ⚡ Performance Optimizations

- **Frontend**: Code splitting, lazy loading, memoization
- **Backend**: Connection pooling, request caching, efficient executors
- **Execution**: Timeout handling, memory limits, process isolation
- **Monitoring**: Execution time tracking, error logging

## 🐛 Troubleshooting

### Common Issues

1. **Backend fails to start**:
   - Check Python version (3.9+ required)
   - Verify all dependencies installed: `pip install -r requirements.txt`
   - Check port 5000 availability

2. **Frontend build fails**:
   - Check Node.js version (16+ required)
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Check for TypeScript errors: `npm run build`

3. **Code execution fails**:
   - Verify language runtimes installed
   - Check executor logs in backend console
   - Ensure proper file permissions

4. **CORS errors**:
   - Update `CORS_ORIGINS` in backend configuration
   - Check frontend API base URL configuration

5. **Go/C# execution issues in Docker**:
   - Use the updated Docker configuration with proper tmpfs mounts
   - Ensure .NET SDK is installed in container
   - Check cache directory permissions: `docker-compose exec app ls -la /home/appuser/.cache/`
   - Run executor tests: `docker-compose exec app python test_executors.py`

### Debug Mode

Enable debug mode for development:

```bash
# Backend
export FLASK_DEBUG=true

# Frontend
npm start  # Already includes debug mode
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

### Development Guidelines

- Follow TypeScript/Python style guides
- Write tests for new features
- Update documentation
- Ensure security best practices

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Monaco Editor** - Microsoft's code editor
- **Flask** - Python web framework
- **React** - JavaScript UI library
- **Docker** - Containerization platform

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check existing documentation
- Review troubleshooting section