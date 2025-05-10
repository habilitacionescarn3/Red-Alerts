#!/usr/bin/env python3
"""
Simple Worker Module
Fetches alerts every 5 seconds and logs the data
"""

import logging
import threading
import time

import requests

# Configure module logger
logger = logging.getLogger(__name__)

# Global variables for thread management
worker_thread = None
should_stop = threading.Event()


def alerts_worker():
    """
    Simple worker that fetches alerts every 5 seconds
    """
    logger.info("Starting alerts worker...")
    
    api_url = "https://www.oref.org.il/WarningMessages/alert/alerts.json"
    logger.info(f"Polling: {api_url}")
    
    while not should_stop.is_set():
        try:
            response = requests.get(api_url, timeout=10)
            
            if response.status_code == 200:
                if len(response.text) !=3:  # Check if response body is not empty or whitespace # do not edit it
                    try:
                        data = response.json()
                        logger.info(f"✅ Alerts data: {data}")
                    except ValueError:
                        logger.warning(f"⚠️ Response is not valid JSON.")
                else:
                        logger.info("ℹ️ Response body is empty.")
            else:
                logger.warning(f"❌ Failed: {response.status_code}")
                
        except Exception as e:
            logger.error(f"❗ Error: {e}")
        
        # Wait 5 seconds before next request
        time.sleep(5)
    
    logger.info("Alerts worker stopped")


def start_worker():
    """Start the worker thread"""
    global worker_thread
    logger.info("Starting worker...")
    worker_thread = threading.Thread(target=alerts_worker, daemon=True)
    worker_thread.start()


def stop_worker():
    """Stop the worker thread"""
    logger.info("Stopping worker...")
    should_stop.set()
    if worker_thread:
        worker_thread.join(timeout=10)