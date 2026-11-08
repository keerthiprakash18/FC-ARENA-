import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
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
import { PrismaService } from '../database/prisma.service.js';

interface ExportViewer {
  sub: string;
  sid?: string;
}
interface ExportGrant extends ExportViewer {
  id: string;
  filename: string;
  expiresAt: number;
}
const FILE_KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/;
const FILENAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,75}\.png$/;
const TTL = 5 * 60_000;

@Injectable()
export class PlayerCardExportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlayerCardExportService.name);
  private timer?: ReturnType<typeof setInterval>;
  constructor(private readonly prisma: PrismaService) {}
  private root() {
    return resolve(process.env.CARD_EXPORT_DIR ?? 'storage/card-exports');
  }
  private file(id: string) {
    if (!FILE_KEY.test(id + '.png'))
      throw new NotFoundException('This card download is unavailable.');
    return resolve(this.root(), id + '.png');
  }
  private sign(payload: string) {
    if (!process.env.JWT_ACCESS_SECRET)
      throw new Error('JWT_ACCESS_SECRET is missing.');
    return createHmac('sha256', process.env.JWT_ACCESS_SECRET)
      .update('player-card-export:' + payload)
      .digest('base64url');
  }
  private async active(viewer: ExportViewer) {
    const user = await this.prisma.user.findUnique({
      where: { id: viewer.sub },
      select: { status: true },
    });
    if (!user || user.status !== 'ACTIVE')
      throw new ForbiddenException(
        'This card download is no longer available.',
      );
    if (viewer.sid) {
      const session = await this.prisma.refreshSession.findUnique({
        where: { id: viewer.sid },
        select: { userId: true, revokedAt: true, expiresAt: true },
      });
      if (
        !session ||
        session.userId !== viewer.sub ||
        session.revokedAt ||
        session.expiresAt.getTime() <= Date.now()
      )
        throw new ForbiddenException(
          'Sign in again to create a new card download.',
        );
    }
  }
  async create(
    viewer: ExportViewer,
    file?: Express.Multer.File,
    requestedName = 'FC-ARENA-player.png',
  ) {
    await this.active(viewer);
    if (!FILENAME.test(requestedName))
      throw new BadRequestException('Choose a valid PNG filename.');
    // Use the existing database-backed rate-limit table; no in-memory per-process bypass.
    const keyHash = createHash('sha256')
      .update('card-export:' + viewer.sub)
      .digest('hex');
    const limits = await this.prisma.$queryRaw<{ attemptCount: number }[]>`
      INSERT INTO auth_rate_limits (action, "keyHash", "windowStartedAt", "attemptCount", "updatedAt")
      VALUES ('PLAYER_CARD_EXPORT', ${keyHash}, (NOW() AT TIME ZONE 'UTC'), 1, (NOW() AT TIME ZONE 'UTC'))
      ON CONFLICT (action, "keyHash") DO UPDATE SET
        "attemptCount" = CASE WHEN auth_rate_limits."windowStartedAt" <= (NOW() AT TIME ZONE 'UTC') - INTERVAL '1 minute' THEN 1 ELSE LEAST(auth_rate_limits."attemptCount" + 1, 11) END,
        "windowStartedAt" = CASE WHEN auth_rate_limits."windowStartedAt" <= (NOW() AT TIME ZONE 'UTC') - INTERVAL '1 minute' THEN (NOW() AT TIME ZONE 'UTC') ELSE auth_rate_limits."windowStartedAt" END,
        "updatedAt" = (NOW() AT TIME ZONE 'UTC') RETURNING "attemptCount"`;
    if (!limits[0] || limits[0].attemptCount > 10)
      throw new HttpException(
        'You have prepared several cards. Please wait a minute and try again.',
        429,
      );
    if (
      !file?.buffer?.length ||
      file.size > 5 * 1024 * 1024 ||
      file.buffer.length > 5 * 1024 * 1024 ||
      file.mimetype !== 'image/png'
    )
      throw new BadRequestException('Upload a PNG player card up to 5 MB.');
    let image: Buffer;
    try {
      const input = sharp(file.buffer, { limitInputPixels: 4_194_304 });
      const meta = await input.metadata();
      if (
        meta.format !== 'png' ||
        (meta.pages ?? 1) > 1 ||
        !meta.width ||
        !meta.height ||
        meta.width > 2048 ||
        meta.height > 2048
      )
        throw new Error();
      image = await input.png({ compressionLevel: 6 }).toBuffer();
      if (image.length > 5 * 1024 * 1024) throw new Error();
    } catch {
      throw new BadRequestException(
        'This player card could not be read. Please create it again.',
      );
    }
    const id = randomUUID();
    const expiresAt = Date.now() + TTL;
    await mkdir(this.root(), { recursive: true, mode: 0o700 });
    await writeFile(this.file(id), image, { mode: 0o600, flag: 'wx' });
    const grant = Buffer.from(
      JSON.stringify({
        id,
        sub: viewer.sub,
        sid: viewer.sid,
        filename: requestedName,
        expiresAt,
      }),
    ).toString('base64url');
    return {
      success: true,
      data: {
        path: `/players/card-exports/${id}?grant=${grant}.${this.sign(grant)}`,
        filename: requestedName,
        expiresAt: new Date(expiresAt).toISOString(),
      },
      error: null,
    };
  }
  async download(id: string, raw?: string) {
    let grant: ExportGrant;
    try {
      if (!raw || raw.length > 1500) throw new Error();
      const [payload, signature, extra] = raw.split('.');
      if (!payload || !signature || extra) throw new Error();
      const expected = Buffer.from(this.sign(payload)),
        actual = Buffer.from(signature);
      if (
        expected.length !== actual.length ||
        !timingSafeEqual(expected, actual)
      )
        throw new Error();
      grant = JSON.parse(
        Buffer.from(payload, 'base64url').toString(),
      ) as ExportGrant;
      if (
        grant.id !== id ||
        !FILENAME.test(grant.filename) ||
        typeof grant.sub !== 'string' ||
        !Number.isFinite(grant.expiresAt) ||
        grant.expiresAt <= Date.now()
      )
        throw new Error();
    } catch {
      throw new ForbiddenException(
        'This card link has expired. Return to your profile and create a new download.',
      );
    }
    await this.active(grant);
    try {
      return { bytes: await readFile(this.file(id)), filename: grant.filename };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        throw new NotFoundException(
          'This card has expired. Create it again from your profile.',
        );
      throw error;
    }
  }
  onModuleInit() {
    if (process.env.CARD_EXPORT_CLEANUP_ENABLED === 'false') return;
    const clean = () => {
      void this.cleanup().catch(() =>
        this.logger.warn('Temporary card cleanup failed.'),
      );
    };
    clean();
    this.timer = setInterval(clean, 10 * 60_000);
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
    for (const entry of entries) {
      if (!entry.isFile() || !FILE_KEY.test(entry.name)) continue;
      const path = resolve(this.root(), entry.name);
      try {
        if ((await stat(path)).mtimeMs < Date.now() - TTL - 60_000)
          await unlink(path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  }
}
