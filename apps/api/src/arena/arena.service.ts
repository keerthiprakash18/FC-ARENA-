import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { ArenaMediaService, type ArenaViewer } from './arena-media.service.js';
import type {
  ArenaReportDto,
  CreateArenaCommentDto,
  CreateArenaPostDto,
  EditArenaPostDto,
  ResolveArenaReportDto,
} from './arena.dto.js';
import {
  decodeArenaCursor,
  encodeArenaCursor,
  normalizePoll,
  normalizeSourceUrl,
} from './arena-policy.js';

const authorSelect = {
  id: true,
  fullName: true,
  player: {
    select: {
      playerCode: true,
      profileImageUrl: true,
      identity: { select: { inGameName: true, isVerified: true } },
    },
  },
} satisfies Prisma.UserSelect;
const resultSelect = {
  id: true,
  matchCode: true,
  status: true,
  tournamentId: true,
  tournament: { select: { name: true } },
  confirmedResult: {
    select: {
      status: true,
      homeScore: true,
      awayScore: true,
      homePenaltyScore: true,
      awayPenaltyScore: true,
    },
  },
  fixture: {
    select: {
      homeRegistration: {
        select: {
          entryName: true,
          members: { select: { user: { select: authorSelect } } },
        },
      },
      awayRegistration: {
        select: {
          entryName: true,
          members: { select: { user: { select: authorSelect } } },
        },
      },
    },
  },
} satisfies Prisma.MatchSelect;
const postSelect = {
  id: true,
  authorUserId: true,
  leagueId: true,
  sourceMatchId: true,
  kind: true,
  body: true,
  sourceUrl: true,
  imageKey: true,
  createdAt: true,
  editedAt: true,
  pollEndsAt: true,
  author: { select: authorSelect },
  league: { select: { id: true, name: true, logoUrl: true } },
  sourceMatch: { select: resultSelect },
  pollOptions: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      label: true,
      position: true,
      _count: { select: { votes: true } },
    },
  },
  _count: { select: { reactions: true } },
} satisfies Prisma.ArenaPostSelect;
type Post = Prisma.ArenaPostGetPayload<{ select: typeof postSelect }>;
type Author = Prisma.UserGetPayload<{ select: typeof authorSelect }>;
interface Access {
  userId: string;
  superAdmin: boolean;
  leagueIds: string[];
  adminLeagueIds: string[];
  blockedIds: string[];
}

function displayAuthor(author: Author | null) {
  return author
    ? {
        id: author.id,
        name: author.player?.identity?.inGameName || author.fullName,
        inGameName: author.player?.identity?.inGameName ?? null,
        playerCode: author.player?.playerCode ?? null,
        avatarUrl: author.player?.profileImageUrl ?? null,
        verified: author.player?.identity?.isVerified ?? false,
      }
    : null;
}
function entryName(
  entry: { entryName: string | null; members: { user: Author }[] } | null,
) {
  return (
    entry?.entryName ||
    entry?.members
      .map((member) => displayAuthor(member.user)!.name)
      .join(' + ') ||
    'Tournament entry'
  );
}

@Injectable()
export class ArenaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: ArenaMediaService,
  ) {}

  private async access(
    userId: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<Access> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        status: true,
        leagueMemberships: { select: { leagueId: true } },
        leagueAdminRoles: { select: { leagueId: true } },
        createdLeagues: { select: { id: true } },
      },
    });
    if (!user || user.status !== 'ACTIVE')
      throw new UnauthorizedException('Your account is not active.');
    const blocked = await db.$queryRaw<{ userId: string }[]>(Prisma.sql`
      SELECT DISTINCT CASE WHEN latest."actorUserId" = ${userId}::uuid THEN latest."targetId" ELSE latest."actorUserId"::text END AS "userId"
      FROM (
        SELECT DISTINCT ON ("actorUserId", "targetId") "actorUserId", "targetId", action
        FROM audit_logs WHERE "targetType" = 'USER' AND action IN ('USER_BLOCKED', 'USER_UNBLOCKED')
          AND ("actorUserId" = ${userId}::uuid OR "targetId" = ${userId})
        ORDER BY "actorUserId", "targetId", "createdAt" DESC, id DESC
      ) latest WHERE latest.action = 'USER_BLOCKED'
    `);
    const adminLeagueIds = [
      ...new Set([
        ...user.leagueAdminRoles.map((role) => role.leagueId),
        ...user.createdLeagues.map((league) => league.id),
      ]),
    ];
    return {
      userId,
      superAdmin: user.role === 'SUPER_ADMIN',
      adminLeagueIds,
      leagueIds: [
        ...new Set([
          ...adminLeagueIds,
          ...user.leagueMemberships.map((member) => member.leagueId),
        ]),
      ],
      blockedIds: blocked.map((row) => row.userId),
    };
  }

  private async league(
    access: Access,
    leagueId: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    if (!access.superAdmin && !access.leagueIds.includes(leagueId))
      throw new NotFoundException('League could not be found.');
    if (
      !(await db.league.findUnique({
        where: { id: leagueId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('League could not be found.');
  }

  private visible(access: Access): Prisma.ArenaPostWhereInput {
    return {
      hiddenAt: null,
      AND: [
        {
          OR: [
            { authorUserId: null },
            { author: { status: 'ACTIVE', id: { notIn: access.blockedIds } } },
          ],
        },
        {
          OR: [
            { sourceMatchId: null },
            {
              sourceMatch: {
                status: 'COMPLETED',
                fixture: { status: 'COMPLETED' },
                confirmedResult: { status: 'CONFIRMED' },
              },
            },
          ],
        },
        ...(access.superAdmin
          ? []
          : [
              {
                OR: [
                  { leagueId: null },
                  { leagueId: { in: access.leagueIds } },
                ],
              },
            ]),
      ],
    };
  }

  private async findVisible(
    viewer: ArenaViewer,
    id: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const access = await this.access(viewer.sub, db);
    const post = await db.arenaPost.findFirst({
      where: { id, ...this.visible(access) },
      select: postSelect,
    });
    if (!post)
      throw new NotFoundException(
        'This post is unavailable or you no longer have access.',
      );
    return { post, access };
  }

  async context(userId: string) {
    const access = await this.access(userId);
    const leagues = await this.prisma.league.findMany({
      where: { id: { in: access.leagueIds } },
      select: { id: true, name: true, logoUrl: true },
      orderBy: { name: 'asc' },
    });
    return {
      success: true,
      data: {
        leagues,
        canModerate: access.superAdmin,
        policy: {
          postCharacters: 2000,
          commentCharacters: 1000,
          imageMegabytes: 5,
          audienceNote:
            'Football Talk is visible to active FC ARENA members. League posts stay within that league. Posts and likes do not earn XP.',
        },
      },
      error: null,
    };
  }

  private async resultPosts(leagueId: string) {
    const matches = await this.prisma.match.findMany({
      where: {
        tournament: { leagueId },
        status: 'COMPLETED',
        fixture: { status: 'COMPLETED' },
        confirmedResult: { status: 'CONFIRMED' },
      },
      select: {
        id: true,
        statEvents: {
          where: { type: 'APPLY' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 20,
    });
    const confirmed = matches.filter((match) => match.statEvents.length);
    if (confirmed.length)
      await this.prisma.arenaPost.createMany({
        data: confirmed.map((match) => ({
          leagueId,
          sourceMatchId: match.id,
          kind: 'RESULT' as const,
          body: '',
          createdAt: match.statEvents[0].createdAt,
        })),
        skipDuplicates: true,
      });
  }

  private async mapPosts(
    posts: Post[],
    viewer: ArenaViewer,
    access: Access,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const ids = posts.map((post) => post.id);
    if (!ids.length) return [];
    const [likes, votes, commentCounts] = await Promise.all([
      db.arenaReaction.findMany({
        where: { userId: viewer.sub, postId: { in: ids } },
        select: { postId: true },
      }),
      db.arenaPollVote.findMany({
        where: { userId: viewer.sub, postId: { in: ids } },
        select: { postId: true, optionId: true },
      }),
      db.arenaComment.groupBy({
        by: ['postId'],
        where: {
          postId: { in: ids },
          hiddenAt: null,
          author: { status: 'ACTIVE', id: { notIn: access.blockedIds } },
        },
        _count: { _all: true },
      }),
    ]);
    return posts.map((post) => {
      const match = post.sourceMatch;
      const result = match?.confirmedResult;
      const home = match ? entryName(match.fixture.homeRegistration) : null;
      const away = match ? entryName(match.fixture.awayRegistration) : null;
      const totalVotes = post.pollOptions.reduce(
        (sum, option) => sum + option._count.votes,
        0,
      );
      return {
        id: post.id,
        kind: post.kind,
        body: post.body,
        sourceUrl: post.sourceUrl,
        audience: post.leagueId ? 'LEAGUE' : 'PUBLIC',
        league: post.league,
        author: displayAuthor(post.author),
        createdAt: post.createdAt,
        editedAt: post.editedAt,
        imageUrl: post.imageKey ? this.media.imageUrl(post.id, viewer) : null,
        reactionCount: post._count.reactions,
        liked: likes.some((like) => like.postId === post.id),
        commentCount:
          commentCounts.find((row) => row.postId === post.id)?._count._all ?? 0,
        canEdit: post.authorUserId === viewer.sub && post.kind !== 'RESULT',
        canDelete:
          post.kind !== 'RESULT' &&
          (post.authorUserId === viewer.sub ||
            access.superAdmin ||
            (post.leagueId !== null &&
              access.adminLeagueIds.includes(post.leagueId))),
        canReport:
          post.authorUserId !== null && post.authorUserId !== viewer.sub,
        result:
          match && result
            ? {
                matchId: match.id,
                tournamentId: match.tournamentId,
                tournamentName: match.tournament.name,
                home,
                away,
                homeScore: result.homeScore,
                awayScore: result.awayScore,
                homePenaltyScore: result.homePenaltyScore,
                awayPenaltyScore: result.awayPenaltyScore,
              }
            : null,
        poll: post.pollOptions.length
          ? {
              endsAt: post.pollEndsAt,
              closed:
                !post.pollEndsAt || post.pollEndsAt.getTime() <= Date.now(),
              totalVotes,
              selectedOptionId:
                votes.find((vote) => vote.postId === post.id)?.optionId ?? null,
              options: post.pollOptions.map((option) => ({
                id: option.id,
                label: option.label,
                votes: option._count.votes,
                percent: totalVotes
                  ? Math.round((option._count.votes / totalVotes) * 100)
                  : 0,
              })),
            }
          : null,
      };
    });
  }

  async feed(
    viewer: ArenaViewer,
    audience: string,
    leagueId?: string,
    rawCursor?: string,
  ) {
    if (!['PUBLIC', 'LEAGUE'].includes(audience))
      throw new BadRequestException('Choose Football Talk or a league feed.');
    const access = await this.access(viewer.sub);
    if (audience === 'LEAGUE') {
      if (!leagueId)
        throw new BadRequestException('Choose a league to view its feed.');
      await this.league(access, leagueId);
      await this.resultPosts(leagueId);
    } else if (leagueId)
      throw new BadRequestException(
        'Football Talk does not use a league audience.',
      );
    const cursor = decodeArenaCursor(rawCursor);
    const posts = await this.prisma.arenaPost.findMany({
      where: {
        ...this.visible(access),
        leagueId: audience === 'LEAGUE' ? leagueId : null,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      select: postSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 21,
    });
    const visible = posts.slice(0, 20);
    return {
      success: true,
      data: {
        posts: await this.mapPosts(visible, viewer, access),
        nextCursor:
          posts.length > 20
            ? encodeArenaCursor(visible[visible.length - 1])
            : null,
      },
      error: null,
    };
  }

  async post(viewer: ArenaViewer, id: string) {
    const { post, access } = await this.findVisible(viewer, id);
    return {
      success: true,
      data: { post: (await this.mapPosts([post], viewer, access))[0] },
      error: null,
    };
  }

  private async limit(count: Promise<number>, maximum: number) {
    if ((await count) >= maximum)
      throw new HttpException(
        'You are posting too quickly. Please try again in a few minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }

  async create(
    viewer: ArenaViewer,
    dto: CreateArenaPostDto,
    file?: Express.Multer.File,
  ) {
    const access = await this.access(viewer.sub);
    if (dto.audience === 'LEAGUE') {
      if (!dto.leagueId)
        throw new BadRequestException('Choose a league before posting.');
      await this.league(access, dto.leagueId);
    } else if (dto.leagueId)
      throw new BadRequestException(
        'A public post cannot include a private league audience.',
      );
    const leagueId = dto.audience === 'LEAGUE' ? dto.leagueId! : null;
    const sourceUrl = normalizeSourceUrl(dto.sourceUrl, dto.kind === 'NEWS');
    const poll = normalizePoll(dto.pollOptions);
    if (!poll.length && dto.pollDurationHours)
      throw new BadRequestException(
        'Add poll options before setting a poll duration.',
      );
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          leagueId,
          kind: dto.kind,
          body: dto.body,
          sourceUrl,
          poll,
          duration: poll.length ? (dto.pollDurationHours ?? 72) : null,
          image: file
            ? createHash('sha256').update(file.buffer).digest('hex')
            : null,
        }),
      )
      .digest('hex');
    const duplicate = await this.prisma.arenaPost.findUnique({
      where: {
        authorUserId_clientRequestId: {
          authorUserId: viewer.sub,
          clientRequestId: dto.clientRequestId,
        },
      },
      select: { id: true, requestHash: true },
    });
    if (duplicate) {
      if (duplicate.requestHash !== hash)
        throw new ConflictException(
          'This request already created different content. Refresh the feed before starting a new post.',
        );
      return this.post(viewer, duplicate.id);
    }
    const image = await this.media.prepare(file);
    let imageKey = image ? await this.media.save(image) : null;
    let keepImage = false;
    try {
      const outcome = await this.prisma.$transactionWithRetry(
        async (db) => {
          const currentAccess = await this.access(viewer.sub, db);
          if (leagueId) await this.league(currentAccess, leagueId, db);
          const existing = await db.arenaPost.findUnique({
            where: {
              authorUserId_clientRequestId: {
                authorUserId: viewer.sub,
                clientRequestId: dto.clientRequestId,
              },
            },
          });
          if (existing) {
            if (existing.requestHash !== hash)
              throw new ConflictException(
                'This post request was already used. Refresh the feed.',
              );
            return { id: existing.id, created: false };
          }
          await this.limit(
            db.arenaPost.count({
              where: {
                authorUserId: viewer.sub,
                createdAt: { gte: new Date(Date.now() - 10 * 60_000) },
              },
            }),
            5,
          );
          const created = await db.arenaPost.create({
            data: {
              authorUserId: viewer.sub,
              leagueId,
              kind: dto.kind,
              body: dto.body,
              sourceUrl,
              imageKey,
              clientRequestId: dto.clientRequestId,
              requestHash: hash,
              pollEndsAt: poll.length
                ? new Date(
                    Date.now() + (dto.pollDurationHours ?? 72) * 3_600_000,
                  )
                : null,
              ...(poll.length
                ? {
                    pollOptions: {
                      create: poll.map((label, position) => ({
                        label,
                        position,
                      })),
                    },
                  }
                : {}),
            },
            select: { id: true },
          });
          return { id: created.id, created: true };
        },
        { isolationLevel: 'Serializable' },
      );
      keepImage = outcome.created;
      if (imageKey && !keepImage) {
        await this.media.remove(imageKey);
        imageKey = null;
      }
      return await this.post(viewer, outcome.id);
    } catch (error) {
      if (imageKey && !keepImage)
        await this.media.remove(imageKey).catch(() => undefined);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.arenaPost.findUnique({
          where: {
            authorUserId_clientRequestId: {
              authorUserId: viewer.sub,
              clientRequestId: dto.clientRequestId,
            },
          },
        });
        if (existing?.requestHash === hash)
          return this.post(viewer, existing.id);
      }
      throw error;
    }
  }

  async editPost(viewer: ArenaViewer, id: string, dto: EditArenaPostDto) {
    await this.prisma.$transactionWithRetry(
      async (db) => {
        const { post } = await this.findVisible(viewer, id, db);
        if (post.authorUserId !== viewer.sub || post.kind === 'RESULT')
          throw new ForbiddenException('You can only edit your own posts.');
        await db.arenaPost.update({
          where: { id },
          data: {
            body: dto.body,
            editedAt: new Date(),
            ...(dto.removeImage ? { imageKey: null } : {}),
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return this.post(viewer, id);
  }

  private canModerate(access: Access, leagueId: string | null) {
    return (
      access.superAdmin ||
      (leagueId !== null && access.adminLeagueIds.includes(leagueId))
    );
  }

  async hidePost(viewer: ArenaViewer, id: string, reason?: string) {
    await this.prisma.$transactionWithRetry(
      async (db) => {
        const { post, access } = await this.findVisible(viewer, id, db);
        if (post.kind === 'RESULT')
          throw new ForbiddenException(
            'Use match verification or a dispute to correct an official result.',
          );
        if (
          post.authorUserId !== viewer.sub &&
          !this.canModerate(access, post.leagueId)
        )
          throw new ForbiddenException('You cannot remove this post.');
        if (post.authorUserId !== viewer.sub && !reason)
          throw new BadRequestException('Add a moderation reason.');
        await db.arenaPost.update({
          where: { id },
          data: { hiddenAt: new Date() },
        });
        await db.auditLog.create({
          data: {
            actorUserId: viewer.sub,
            action: 'ARENA_POST_REMOVED',
            targetType: 'ARENA_POST',
            targetId: id,
            scopeType: post.leagueId ? 'LEAGUE' : 'GLOBAL',
            scopeId: post.leagueId,
            metadata: { reason: reason ?? 'Removed by author' },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return { success: true, data: { removed: true }, error: null };
  }

  async react(viewer: ArenaViewer, id: string, liked: boolean) {
    await this.prisma.$transactionWithRetry(
      async (db) => {
        await this.findVisible(viewer, id, db);
        if (liked)
          await db.arenaReaction.upsert({
            where: { postId_userId: { postId: id, userId: viewer.sub } },
            create: { postId: id, userId: viewer.sub },
            update: {},
          });
        else
          await db.arenaReaction.deleteMany({
            where: { postId: id, userId: viewer.sub },
          });
      },
      { isolationLevel: 'Serializable' },
    );
    return this.post(viewer, id);
  }

  async vote(viewer: ArenaViewer, id: string, optionId: string) {
    await this.prisma.$transactionWithRetry(
      async (db) => {
        const { post } = await this.findVisible(viewer, id, db);
        if (!post.pollEndsAt || post.pollEndsAt.getTime() <= Date.now())
          throw new ConflictException('This poll is closed.');
        if (!post.pollOptions.some((option) => option.id === optionId))
          throw new BadRequestException('Choose an option from this poll.');
        await db.arenaPollVote.upsert({
          where: { postId_userId: { postId: id, userId: viewer.sub } },
          create: { postId: id, userId: viewer.sub, optionId },
          update: { optionId },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return this.post(viewer, id);
  }

  async comments(viewer: ArenaViewer, postId: string, rawCursor?: string) {
    const { access, post } = await this.findVisible(viewer, postId);
    const cursor = decodeArenaCursor(rawCursor);
    const comments = await this.prisma.arenaComment.findMany({
      where: {
        postId,
        hiddenAt: null,
        author: { status: 'ACTIVE', id: { notIn: access.blockedIds } },
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        editedAt: true,
        authorUserId: true,
        author: { select: authorSelect },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 21,
    });
    const visible = comments.slice(0, 20);
    return {
      success: true,
      data: {
        comments: visible.map((comment) => ({
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt,
          editedAt: comment.editedAt,
          author: displayAuthor(comment.author),
          canEdit: comment.authorUserId === viewer.sub,
          canDelete:
            comment.authorUserId === viewer.sub ||
            this.canModerate(access, post.leagueId),
          canReport: comment.authorUserId !== viewer.sub,
        })),
        nextCursor:
          comments.length > 20
            ? encodeArenaCursor(visible[visible.length - 1])
            : null,
      },
      error: null,
    };
  }

  async comment(
    viewer: ArenaViewer,
    postId: string,
    dto: CreateArenaCommentDto,
  ) {
    try {
      await this.prisma.$transactionWithRetry(
        async (db) => {
          await this.findVisible(viewer, postId, db);
          const existing = await db.arenaComment.findUnique({
            where: {
              authorUserId_clientRequestId: {
                authorUserId: viewer.sub,
                clientRequestId: dto.clientRequestId,
              },
            },
          });
          if (existing) {
            if (
              existing.postId !== postId ||
              existing.body !== dto.body ||
              existing.hiddenAt
            )
              throw new ConflictException(
                'This comment request was already used. Refresh the conversation.',
              );
            return;
          }
          await this.limit(
            db.arenaComment.count({
              where: {
                authorUserId: viewer.sub,
                createdAt: { gte: new Date(Date.now() - 10 * 60_000) },
              },
            }),
            30,
          );
          await db.arenaComment.create({
            data: {
              postId,
              authorUserId: viewer.sub,
              body: dto.body,
              clientRequestId: dto.clientRequestId,
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      )
        throw error;
      const existing = await this.prisma.arenaComment.findUnique({
        where: {
          authorUserId_clientRequestId: {
            authorUserId: viewer.sub,
            clientRequestId: dto.clientRequestId,
          },
        },
      });
      if (
        !existing ||
        existing.postId !== postId ||
        existing.body !== dto.body ||
        existing.hiddenAt
      )
        throw new ConflictException(
          'This comment request was already used. Refresh the conversation.',
        );
    }
    return this.comments(viewer, postId);
  }

  async editComment(
    viewer: ArenaViewer,
    postId: string,
    commentId: string,
    body: string,
  ) {
    await this.prisma.$transactionWithRetry(
      async (db) => {
        await this.findVisible(viewer, postId, db);
        const comment = await db.arenaComment.findFirst({
          where: {
            id: commentId,
            postId,
            authorUserId: viewer.sub,
            hiddenAt: null,
          },
        });
        if (!comment)
          throw new NotFoundException('Comment could not be found.');
        await db.arenaComment.update({
          where: { id: commentId },
          data: { body, editedAt: new Date() },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return this.comments(viewer, postId);
  }

  async hideComment(
    viewer: ArenaViewer,
    postId: string,
    commentId: string,
    reason?: string,
  ) {
    await this.prisma.$transactionWithRetry(
      async (db) => {
        const { post, access } = await this.findVisible(viewer, postId, db);
        const comment = await db.arenaComment.findFirst({
          where: {
            id: commentId,
            postId,
            hiddenAt: null,
            author: { id: { notIn: access.blockedIds } },
          },
        });
        if (!comment)
          throw new NotFoundException('Comment could not be found.');
        if (
          comment.authorUserId !== viewer.sub &&
          !this.canModerate(access, post.leagueId)
        )
          throw new ForbiddenException('You cannot remove this comment.');
        if (comment.authorUserId !== viewer.sub && !reason)
          throw new BadRequestException('Add a moderation reason.');
        await db.arenaComment.update({
          where: { id: commentId },
          data: { hiddenAt: new Date() },
        });
        await db.auditLog.create({
          data: {
            actorUserId: viewer.sub,
            action: 'ARENA_COMMENT_REMOVED',
            targetType: 'ARENA_COMMENT',
            targetId: commentId,
            scopeType: post.leagueId ? 'LEAGUE' : 'GLOBAL',
            scopeId: post.leagueId,
            metadata: { reason: reason ?? 'Removed by author' },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return this.comments(viewer, postId);
  }

  async report(
    viewer: ArenaViewer,
    postId: string,
    dto: ArenaReportDto,
    commentId?: string,
  ) {
    const targetKey = commentId ? `comment:${commentId}` : `post:${postId}`;
    const report = await this.prisma.$transactionWithRetry(
      async (db) => {
        const { post, access } = await this.findVisible(viewer, postId, db);
        let authorUserId = post.authorUserId;
        if (commentId) {
          const comment = await db.arenaComment.findFirst({
            where: {
              id: commentId,
              postId,
              hiddenAt: null,
              author: { status: 'ACTIVE', id: { notIn: access.blockedIds } },
            },
          });
          if (!comment)
            throw new NotFoundException('Comment could not be found.');
          authorUserId = comment.authorUserId;
        }
        if (!authorUserId || authorUserId === viewer.sub)
          throw new BadRequestException(
            'You can report another player’s post or comment. Use a match dispute for official results.',
          );
        const existing = await db.arenaReport.findUnique({
          where: {
            reporterUserId_targetKey: { reporterUserId: viewer.sub, targetKey },
          },
        });
        if (existing) return existing;
        await this.limit(
          db.arenaReport.count({
            where: {
              reporterUserId: viewer.sub,
              createdAt: { gte: new Date(Date.now() - 3_600_000) },
            },
          }),
          10,
        );
        return db.arenaReport.create({
          data: {
            reporterUserId: viewer.sub,
            postId,
            commentId,
            targetKey,
            reason: dto.reason,
            details: dto.details,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return {
      success: true,
      data: {
        report: { id: report.id, status: report.status },
        message: 'Report received. A moderator can review this content.',
      },
      error: null,
    };
  }

  private async moderator(userId: string) {
    const access = await this.access(userId);
    if (!access.superAdmin)
      throw new ForbiddenException('Community moderation access is required.');
  }

  async reports(userId: string) {
    await this.moderator(userId);
    const reports = await this.prisma.arenaReport.findMany({
      where: { status: 'OPEN' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 50,
      select: {
        id: true,
        reason: true,
        details: true,
        targetKey: true,
        createdAt: true,
        reporter: { select: authorSelect },
        post: {
          select: {
            id: true,
            body: true,
            kind: true,
            imageKey: true,
            league: { select: { name: true } },
            author: { select: authorSelect },
          },
        },
        comment: {
          select: { id: true, body: true, author: { select: authorSelect } },
        },
      },
    });
    return {
      success: true,
      data: {
        reports: reports.map((report) => ({
          ...report,
          reporter: displayAuthor(report.reporter),
          post: {
            id: report.post.id,
            body: report.post.body,
            kind: report.post.kind,
            league: report.post.league,
            imageUrl: report.post.imageKey
              ? this.media.imageUrl(report.post.id, { sub: userId })
              : null,
            author: displayAuthor(report.post.author),
          },
          comment: report.comment
            ? {
                ...report.comment,
                author: displayAuthor(report.comment.author),
              }
            : null,
        })),
      },
      error: null,
    };
  }

  async resolveReport(userId: string, id: string, dto: ResolveArenaReportDto) {
    await this.moderator(userId);
    await this.prisma.$transactionWithRetry(
      async (db) => {
        const report = await db.arenaReport.findUnique({ where: { id } });
        if (!report) throw new NotFoundException('Report could not be found.');
        if (report.status !== 'OPEN')
          throw new ConflictException(
            'This report has already been reviewed. Refresh the queue.',
          );
        if (dto.action === 'HIDE') {
          if (report.commentId)
            await db.arenaComment.update({
              where: { id: report.commentId },
              data: { hiddenAt: new Date() },
            });
          else
            await db.arenaPost.update({
              where: { id: report.postId },
              data: { hiddenAt: new Date() },
            });
        }
        await db.arenaReport.updateMany({
          where:
            dto.action === 'HIDE'
              ? { targetKey: report.targetKey, status: 'OPEN' }
              : { id, status: 'OPEN' },
          data: {
            status: dto.action === 'HIDE' ? 'RESOLVED' : 'DISMISSED',
            reviewedByUserId: userId,
            resolvedAt: new Date(),
            resolutionNote: dto.note,
          },
        });
        await db.auditLog.create({
          data: {
            actorUserId: userId,
            action: 'ARENA_REPORT_REVIEWED',
            targetType: 'ARENA_REPORT',
            targetId: id,
            scopeType: 'GLOBAL',
            metadata: {
              action: dto.action,
              targetKey: report.targetKey,
              note: dto.note,
            },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return { success: true, data: { reviewed: true }, error: null };
  }

  async image(postId: string, grant?: string) {
    const viewer = this.media.verifyGrant(postId, grant);
    if (viewer.sid) {
      const session = await this.prisma.refreshSession.findUnique({
        where: { id: viewer.sid },
        select: { userId: true, expiresAt: true, revokedAt: true },
      });
      if (
        !session ||
        session.userId !== viewer.sub ||
        session.revokedAt ||
        session.expiresAt.getTime() <= Date.now()
      )
        throw new ForbiddenException('This session is no longer active.');
    }
    const { post } = await this.findVisible(viewer, postId);
    if (!post.imageKey)
      throw new NotFoundException('Image could not be found.');
    try {
      return await this.media.read(post.imageKey);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        throw new NotFoundException('Image could not be found.');
      throw error;
    }
  }
}
