"""Red Alerts shared backend codebase.

Deployed as the CDK-managed Lambda layer ``backend-code-layer`` (mounted under
``/opt/python/codebase`` at runtime) and also COPYed into the worker container
image, so the same code is reused by both the API Lambda and the ECS worker.
"""
