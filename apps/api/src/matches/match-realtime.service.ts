import {
  Injectable,
} from '@nestjs/common';

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
export class MatchRealtimeService {
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

    const bucket =
      this.listeners.get(
        matchId,
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
