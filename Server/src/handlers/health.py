import json

def lambda_handler(event, context):
    """
    Simple health check endpoint that returns hello world
    """
    
    response = {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        'body': json.dumps({
            'message': 'Hello World!',
            'service': 'Red Alerts Backend',
            'status': 'healthy',
            'timestamp': context.aws_request_id if context else 'local'
        })
    }
    
    return response