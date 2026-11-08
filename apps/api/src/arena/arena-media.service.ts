import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  mkdir,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { assertImageFormat } from '../security/image-format.js';
import { PrismaService } from '../database/prisma.service.js';

export interface ArenaViewer {
  sub: string;
  sid?: string;
}
type ImageGrant = {
  postId: string;
  sub: string;
  sid?: string;
  expiresAt: number;
};

@Injectable()
export class ArenaMediaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ArenaMediaService.name);
  private timer?: ReturnType<typeof setInterval>;
  constructor(private readonly prisma: PrismaService) {}
  private root() {
    return resolve(
      process.cwd(),
      process.env.ARENA_MEDIA_DIR ?? 'storage/arena-talk',
    );
  }
  private path(key: string) {
    if (!/^[0-9a-f-]{36}\.webp$/.test(key))
      throw new BadRequestException('Invalid image reference.');
    return resolve(this.root(), key);
  }
  private secret() {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error('JWT_ACCESS_SECRET is missing.');
    return secret;
  }
  private signature(payload: string) {
    return createHmac('sha256', this.secret())
      .update('arena-media:' + payload)
      .digest('base64url');
  }
  imageUrl(postId: string, viewer: ArenaViewer) {
    const payload = Buffer.from(
      JSON.stringify({
        postId,
        sub: viewer.sub,
        sid: viewer.sid,
        expiresAt: Date.now() + 10 * 60_000,
      }),
    ).toString('base64url');
    return `/arena-talk/posts/${postId}/image?grant=${payload}.${this.signature(payload)}`;
  }
  verifyGrant(postId: string, grant?: string): ImageGrant {
    try {
      if (!grant || grant.length > 1000) throw new Error();
      const [payload, signature, extra] = grant.split('.');
      if (!payload || !signature || extra) throw new Error();
      const expected = Buffer.from(this.signature(payload));
      const actual = Buffer.from(signature);
      if (
        expected.length !== actual.length ||
        !timingSafeEqual(expected, actual)
      )
        throw new Error();
      const decoded = JSON.parse(
        Buffer.from(payload, 'base64url').toString(),
      ) as ImageGrant;
      if (
        decoded.postId !== postId ||
        typeof decoded.sub !== 'string' ||
        !Number.isFinite(decoded.expiresAt) ||
        decoded.expiresAt <= Date.now()
      )
        throw new Error();
      return decoded;
    } catch {
      throw new ForbiddenException(
        'This image link has expired or is invalid. Refresh the feed.',
      );
    }
  }
  async prepare(file?: Express.Multer.File) {
    if (!file) return null;
    if (
      !file.buffer?.length ||
      file.size > 5 * 1024 * 1024 ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
    ) {
      throw new BadRequestException(
        'Choose a JPG, PNG or WEBP image up to 5 MB.',
      );
    }
    try {
      const metadata = await sharp(file.buffer, {
        limitInputPixels: 24_000_000,
      }).metadata();
      assertImageFormat(file.mimetype, metadata.format);
      if ((metadata.pages ?? 1) > 1) throw new Error();
      const data = await sharp(file.buffer, { limitInputPixels: 24_000_000 })
        .rotate()
        .resize({
          width: 1280,
          height: 1280,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 78 })
        .toBuffer();
      if (data.length > 1024 * 1024) throw new Error();
      return data;
    } catch {
      throw new BadRequestException(
        'This image could not be processed. Choose a clear, non-animated image.',
      );
    }
  }
  async save(data: Buffer) {
    await mkdir(this.root(), { recursive: true });
    const key = `${randomUUID()}.webp`;
    await writeFile(this.path(key), data, { flag: 'wx', mode: 0o600 });
    return key;
  }
  read(key: string) {
    return readFile(this.path(key));
  }
  async remove(key: string) {
    try {
      await unlink(this.path(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  onModuleInit() {
    if (process.env.ARENA_MEDIA_CLEANUP_ENABLED === 'false') return;
    this.timer = setInterval(
      () => {
        void this.cleanup().catch(() =>
          this.logger.warn('Arena Talk image cleanup failed.'),
        );
      },
      6 * 60 * 60_000,
    );
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async cleanup() {
    const entries = await readdir(this.root(), { withFileTypes: true }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return [];
        throw error;
      },
    );
    let removed = 0;
    for (const entry of entries) {
      if (removed >= 500) break;
      if (!entry.isFile() || !/^[0-9a-f-]{36}\.webp$/.test(entry.name))
        continue;
      const info = await stat(this.path(entry.name));
      if (info.mtimeMs > Date.now() - 24 * 60 * 60_000) continue;
      const post = await this.prisma.arenaPost.findFirst({
        where: { imageKey: entry.name },
        select: { hiddenAt: true },
      });
      if (
        !post ||
        (post.hiddenAt &&
          post.hiddenAt.getTime() < Date.now() - 30 * 24 * 60 * 60_000)
      ) {
        await this.remove(entry.name);
        removed++;
      }
    }
    return removed;
  }
}
