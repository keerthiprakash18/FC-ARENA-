import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { boundedRedisOptions } from '../security/redis-options.js';

export interface MatchRealtimeEvent {
  type: string;
  matchId: string;
  at: string;
  data?:
    Record<
      string,
      unknown
    >;
}

type Listener =
  (
    event:
      MatchRealtimeEvent,
  ) => void;

@Injectable()
export class MatchRealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly origin = randomUUID();
  private readonly channel = 'fcarena:match-events:v1';
  private readonly logger = new Logger(MatchRealtimeService.name);
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private lastWarningAt = 0;

  async onModuleInit() {
    if (process.env.MATCH_REALTIME_REDIS_ENABLED !== 'true') return;
    this.publisher = new Redis(boundedRedisOptions());
    this.subscriber = new Redis(boundedRedisOptions());
    this.publisher.on('error', () => {});
    this.subscriber.on('error', () => {});
    this.subscriber.on('message', (channel, body) => {
      if (channel !== this.channel || body.length > 65536) return;
      try {
        const packet = JSON.parse(body) as { origin?: string; event?: MatchRealtimeEvent };
        if (packet.origin === this.origin || !packet.event || typeof packet.event.matchId !== 'string' ||
          typeof packet.event.type !== 'string' || typeof packet.event.at !== 'string') return;
        this.deliver(packet.event);
      } catch { /* malformed broker messages cannot terminate a private stream */ }
    });
    this.subscriber.on('ready', () => { void this.subscriber?.subscribe(this.channel).catch(() => this.warnUnavailable()); });
    try {
      await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
      await this.subscriber.subscribe(this.channel);
    } catch { this.warnUnavailable(); }
  }

  onModuleDestroy() {
    this.publisher?.disconnect(); this.subscriber?.disconnect();
    this.publisher = null; this.subscriber = null; this.listeners.clear();
  }

  private warnUnavailable() {
    if (Date.now() - this.lastWarningAt < 30000) return;
    this.lastWarningAt = Date.now();
    this.logger.warn('Cross-instance match updates unavailable; local events and REST refresh remain active.');
  }
  private readonly listeners =
    new Map<
      string,
      Set<Listener>
    >();

  subscribe(
    matchId: string,
    listener:
      Listener,
  ) {
    let bucket =
      this.listeners.get(
        matchId,
      );

    if (!bucket) {
      bucket =
        new Set<Listener>();

      this.listeners.set(
        matchId,
        bucket,
      );
    }

    bucket.add(
      listener,
    );

    return () => {
      bucket?.delete(
        listener,
      );

      if (
        bucket &&
        bucket.size ===
          0
      ) {
        this.listeners.delete(
          matchId,
        );
      }
    };
  }

  publish(
    matchId: string,
    type: string,
    data?:
      Record<
        string,
        unknown
      >,
  ) {
    const event:
      MatchRealtimeEvent = {
        type,
        matchId,
        at:
          new Date()
            .toISOString(),
        data,
      };

    this.deliver(event);
    if (this.publisher) {
      void this.publisher.publish(this.channel, JSON.stringify({ origin: this.origin, event }))
        .catch(() => this.warnUnavailable());
    }
  }

  private deliver(event: MatchRealtimeEvent) {
    const bucket =
      this.listeners.get(
        event.matchId,
      );

    if (!bucket) {
      return;
    }

    for (
      const listener
      of bucket
    ) {
      try {
        listener(
          event,
        );
      } catch {
        // A broken client listener
        // must never block other
        // Match Room subscribers.
      }
    }
  }
}
