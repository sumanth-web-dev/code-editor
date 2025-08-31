# Multi-stage build for production deployment
FROM node:18-alpine AS frontend-builder

# Set working directory for frontend
WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./

# Install frontend dependencies (including devDependencies for build)
RUN npm ci --only=production --no-audit --no-fund

# Copy frontend source code
COPY frontend/ ./

# Set build environment variables and build frontend
ENV NODE_ENV=production \
    REACT_APP_API_URL= \
    GENERATE_SOURCEMAP=false \
    INLINE_RUNTIME_CHUNK=false \
    IMAGE_INLINE_SIZE_LIMIT=0

RUN npm run build

# Backend stage
FROM python:3.11-slim AS backend

# Install system dependencies for code execution and database
# Supports: Python, JavaScript/Node.js, Java, C, C++, C#/.NET, PHP, Ruby, Go, Rust, R, TypeScript, HTML, CSS
# Enhanced MySQL support and optimized package installation
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    clang \
    libc6-dev \
    default-jdk \
    nodejs \
    npm \
    php \
    ruby \
    golang-go \
    r-base \
    r-base-dev \
    r-recommended \
    curl \
    wget \
    build-essential \
    default-mysql-client \
    libmysqlclient-dev \
    mysql-client \
    pkg-config \
    git \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* \
    && rm -rf /var/tmp/*

# Install .NET SDK (optimized)
RUN curl -sSL https://dot.net/v1/dotnet-install.sh | bash /dev/stdin --channel 6.0 --install-dir /usr/share/dotnet && \
    ln -s /usr/share/dotnet/dotnet /usr/local/bin/dotnet

# Install Rust (optimized)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"

# Install TypeScript globally
RUN npm install -g typescript@latest --no-audit --no-fund

# Set working directory for backend
WORKDIR /app

# Copy backend requirements (split for better reliability and caching)
COPY backend/requirements-core.txt backend/requirements-ai.txt backend/requirements-utils.txt backend/requirements-payment.txt ./

# Install Python dependencies with MySQL support
RUN pip install --upgrade pip --no-cache-dir && \
    # Install MySQL dependencies first
    pip install --no-cache-dir --timeout=300 --retries=3 \
    PyMySQL==1.1.0 \
    SQLAlchemy==2.0.23 \
    mysqlclient && \
    # Install gunicorn (required for production)
    pip install --no-cache-dir --timeout=300 --retries=3 \
    gunicorn==21.2.0 && \
    # Install core Flask dependencies
    pip install --no-cache-dir --timeout=300 --retries=3 \
    -r requirements-core.txt && \
    # Install payment system dependencies (authentication, database, payments)
    pip install --no-cache-dir --timeout=300 --retries=3 \
    -r requirements-payment.txt && \
    # Install AI dependencies
    pip install --no-cache-dir --timeout=300 --retries=3 \
    -r requirements-ai.txt && \
    # Install utility dependencies
    pip install --no-cache-dir --timeout=300 --retries=3 \
    -r requirements-utils.txt && \
    # Clean up pip cache
    pip cache purge

# Copy backend source code
COPY backend/ ./

# Copy built frontend files
COPY --from=frontend-builder /app/frontend/build ./static

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash appuser
RUN chown -R appuser:appuser /app

# Create optimized directory structure
RUN mkdir -p \
    /home/appuser/.cache \
    /home/appuser/.local \
    /home/appuser/.config \
    /home/appuser/.cargo \
    /app/logs \
    /app/uploads \
    /app/backups \
    && chown -R appuser:appuser /home/appuser /app/logs /app/uploads /app/backups \
    && chmod -R 755 /home/appuser \
    && chmod -R 750 /app/logs /app/uploads /app/backups

USER appuser

# Install Rust for appuser (copy from root installation)
RUN cp -r /root/.cargo /home/appuser/ && \
    cp -r /root/.rustup /home/appuser/ 2>/dev/null || true

# Set optimized environment variables
ENV GOCACHE=/home/appuser/.cache/go-build \
    GOPATH=/home/appuser/.local/go \
    DOTNET_CLI_HOME=/home/appuser/.config/dotnet \
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1 \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1 \
    DOTNET_ROOT=/usr/share/dotnet \
    CARGO_HOME=/home/appuser/.cargo \
    RUSTUP_HOME=/home/appuser/.rustup \
    PATH="/home/appuser/.cargo/bin:${PATH}" \
    FLASK_ENV=production \
    PYTHONPATH=/app \
    LOG_LEVEL=INFO \
    MYSQL_CLIENT_PATH=/usr/bin/mysql

# Expose port
EXPOSE 5000

# Health check (updated for new health endpoint)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Application is ready to start

# Start the application with proper configuration for payment system
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "--timeout", "120", "--worker-class", "sync", "--max-requests", "1000", "--max-requests-jitter", "100", "--preload", "app:create_app()"]