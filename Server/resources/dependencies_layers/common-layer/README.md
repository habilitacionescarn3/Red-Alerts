# common-layer (auto-built Lambda layer)

Third-party Python dependencies for the **API Lambda**, packaged as a Lambda
layer. **CDK builds this layer automatically** from `requirements.txt` at deploy
time - there is nothing to publish manually and no ARN to pass in.

How it works (see `lib/lambda_service.ts`): CDK runs
`pip install -r requirements.txt -t /asset-output/python` inside the Python 3.11
ARM64 Lambda build image, so the native wheels (e.g. `pydantic-core`) match the
runtime. This requires **Docker** to be available during `cdk synth`/`deploy`
(already needed for the worker container image).

## Changing dependencies

Just edit `requirements.txt` and redeploy - CDK rebuilds the layer.

> `boto3` is intentionally omitted: it is already present in the Lambda runtime,
> and the API no longer reads from AWS at runtime (the DB connection is provided
> via the `DATABASE_URL` environment variable).

## Local development

`make setup` installs these same requirements (plus `uvicorn` and `boto3`) into
`.venv`, so the API and worker run locally against the identical dependency set.
