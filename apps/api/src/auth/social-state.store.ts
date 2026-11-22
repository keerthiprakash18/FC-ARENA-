import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Redis } from 'ioredis';
import { boundedRedisOptions } from '../security/redis-options.js';

@Injectable()
export class SocialStateStore implements OnModuleDestroy {
  private redis?: Redis;
  private connecting?: Promise<void>;
  private key(kind: string, token: string) {
    return (
      'fcarena:social:v1:' +
      kind +
      ':' +
      createHash('sha256').update(token).digest('hex')
    );
  }
  private async client() {
    if (!this.redis) {
      this.redis = new Redis(boundedRedisOptions());
      this.redis.on('error', () => {});
    }
    if (this.redis.status === 'ready') return this.redis;
    if (this.redis.status === 'wait') this.connecting = this.redis.connect();
    try {
      await this.connecting;
      if (String(this.redis.status) !== 'ready') throw Error();
      return this.redis;
    } catch {
      throw new ServiceUnavailableException(
        'Social sign-in is temporarily unavailable. Use email sign-in or retry.',
      );
    }
  }
  async put(kind: string, token: string, value: unknown, seconds = 600) {
    const redis = await this.client();
    await redis.set(
      this.key(kind, token),
      JSON.stringify(value),
      'EX',
      seconds,
    );
  }
  async read<T>(kind: string, token: string): Promise<T | null> {
    const value = await (await this.client()).get(this.key(kind, token));
    return value ? (JSON.parse(value) as T) : null;
  }
  async take<T>(kind: string, token: string): Promise<T | null> {
    const value = await (await this.client()).getdel(this.key(kind, token));
    return value ? (JSON.parse(value) as T) : null;
  }
  async remove(kind: string, token: string) {
    await (await this.client()).del(this.key(kind, token));
  }
  async lock(token: string) {
    const key = this.key('lock', token),
      owner = randomBytes(32).toString('base64url'),
      redis = await this.client();
    if (!(await redis.set(key, owner, 'EX', 60, 'NX'))) return null;
    return async () => {
      await redis.eval(
        "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",
        1,
        key,
        owner,
      );
    };
  }
  onModuleDestroy() {
    this.redis?.disconnect();
  }
}
