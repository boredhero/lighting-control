FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install Python deps — inject version from info.yml (single source of truth)
COPY pyproject.toml uv.lock info.yml ./
COPY README.md ./
RUN VERSION=$(grep '^version:' info.yml | awk '{print $2}') && sed -i "s/__LIGHTING_VERSION__/$VERSION/" pyproject.toml
RUN uv sync --frozen --no-dev --no-editable

# Copy source
COPY src/ src/
COPY alembic/ alembic/
COPY alembic.ini ./

# Copy built frontend (injected by CI)
COPY frontend/dist/ static/

# Data directory
RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 8420

CMD ["uv", "run", "uvicorn", "lighting_control.main:app", "--host", "0.0.0.0", "--port", "8420", "--log-level", "info"]
