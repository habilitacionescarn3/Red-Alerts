#!/usr/bin/env python3
"""
Red Alerts ECS Service - Timestamp Logger

This script runs continuously in an ECS container and logs the current timestamp
every 5 seconds. It includes proper signal handling for graceful shutdown.
"""

import json
import logging
import signal
import sys
import time
from datetime import datetime
from typing import Dict, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TimestampLogger:
    """Main class for the timestamp logging service"""
    
    def __init__(self):
        self.running = True
        self.setup_signal_handlers()
    
    def setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown"""
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info(f"Received signal {signum}. Shutting down gracefully...")
        self.running = False
    
    def create_alert_message(self) -> Dict[str, Any]:
        """Create a structured alert message with timestamp"""
        now = datetime.utcnow()
        
        return {
            "message": "Red Alerts Service - Health Check",
            "timestamp": now.isoformat() + "Z",
            "service": "getAlerts-ecs",
            "status": "running",
            "unix_timestamp": int(now.timestamp())
        }
    
    def log_timestamp(self):
        """Log the current timestamp with structured data"""
        alert_message = self.create_alert_message()
        
        # Log as JSON for structured logging
        logger.info(f"JSON: {json.dumps(alert_message)}")
        
        # Also log a human-readable format
        readable_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        logger.info(f"[{readable_time}] {alert_message['message']}")
    
    def run(self):
        """Main run loop"""
        logger.info("Starting Red Alerts Service...")
        logger.info("Service will log timestamp every 5 seconds until stopped")
        
        try:
            while self.running:
                self.log_timestamp()
                
                # Sleep for 5 seconds, but check for shutdown signal every second
                for _ in range(5):
                    if not self.running:
                        break
                    time.sleep(1)
                    
        except Exception as e:
            logger.error(f"Unexpected error in main loop: {e}")
            raise
        finally:
            logger.info("Shutting down Red Alerts Service...")

def main():
    """Main entry point"""
    try:
        service = TimestampLogger()
        service.run()
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt. Exiting...")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)
    
    logger.info("Service stopped successfully")
    sys.exit(0)

if __name__ == "__main__":
    main()