# Build context is the Server/ root (so we can COPY the shared codebase AND the
# worker). Built+pushed to ECR by `make push-docker` (docker buildx, linux/arm64);
# CDK's ECS task then pulls it from that repo by tag. Build from Server/:
#   docker buildx build --platform linux/arm64 -f app/worker/Dockerfile .
FROM --platform=linux/arm64 python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/*

# Install worker dependencies first for better layer caching.
COPY app/worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Shared backend code - the SAME modules the API Lambda gets via backend-code-layer.
# This includes codebase/models/sync.py, so an operator can `aws ecs execute-command`
# into the task and run `python -c "from codebase.models import sync_database; sync_database()"`
# to sync the schema from inside the VPC if ever needed (the worker does NOT sync on boot).
COPY layer/python/codebase ./codebase

# Worker entrypoint.
COPY app/worker/worker.py .

# Run as a non-root user.
RUN groupadd -r appgroup && useradd -r -g appgroup appuser \
    && chown -R appuser:appgroup /app
USER appuser

CMD ["python", "worker.py"]
