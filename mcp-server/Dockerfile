FROM python:3.12-slim

WORKDIR /app

# Install uv and curl for healthcheck
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy project files
COPY pyproject.toml uv.lock ./
COPY main.py ./

# Install dependencies
RUN uv sync --frozen

# Expose MCP server port
EXPOSE 8001

# Run the MCP server
CMD ["uv", "run", "python", "main.py"]
