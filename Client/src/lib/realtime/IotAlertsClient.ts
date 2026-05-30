import mqtt, { type MqttClient } from 'mqtt';
import { buildPresignedIotUrl } from './signer';
import { iotConfig } from './config';
import type { AlertBroadcast } from '@/types/alerts';

export type RealtimeStatus = 'connecting' | 'connected' | 'offline';

export interface IotClientCallbacks {
  onStatus: (status: RealtimeStatus) => void;
  onBroadcast: (broadcast: AlertBroadcast) => void;
}

/**
 * Subscribes to the AWS IoT broadcast topic over MQTT-over-WSS and emits each
 * decoded alert. Credentials expire, so we manage reconnection ourselves
 * (re-presigning a fresh URL on every attempt) instead of relying on mqtt.js's
 * built-in reconnect, which would reuse the now-stale signed URL.
 */
export class IotAlertsClient {
  private client: MqttClient | null = null;
  private stopped = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private readonly callbacks: IotClientCallbacks;

  constructor(callbacks: IotClientCallbacks) {
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    this.stopped = false;
    await this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    this.callbacks.onStatus('connecting');

    let url: string;
    try {
      url = await buildPresignedIotUrl();
    } catch {
      this.callbacks.onStatus('offline');
      this.scheduleReconnect();
      return;
    }
    if (this.stopped) return;

    const clientId = `red-alerts-web-${Math.random().toString(16).slice(2)}-${Date.now()}`;
    const client = mqtt.connect(url, {
      clientId,
      reconnectPeriod: 0,
      connectTimeout: 15000,
      clean: true,
      protocolVersion: 4,
    });
    this.client = client;

    client.on('connect', () => {
      this.attempts = 0;
      client.subscribe(iotConfig.topic, { qos: 1 }, (err) => {
        if (err) {
          client.end(true);
        } else {
          this.callbacks.onStatus('connected');
        }
      });
    });

    client.on('message', (_topic, payload) => {
      try {
        const parsed = JSON.parse(payload.toString()) as AlertBroadcast;
        if (parsed?.event?.id) {
          this.callbacks.onBroadcast(parsed);
        }
      } catch {
        // Ignore malformed payloads.
      }
    });

    client.on('error', () => {
      client.end(true);
    });

    client.on('close', () => {
      if (!this.stopped) {
        this.callbacks.onStatus('offline');
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.attempts += 1;
    const delay = Math.min(30000, 1000 * 2 ** Math.min(this.attempts, 4));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }
}
