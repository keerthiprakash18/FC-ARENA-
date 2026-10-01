import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PrismaService,
} from '../database/prisma.service.js';

import {
  AuthorizationService,
} from '../security/authorization.service.js';

import type {
  CreateSponsorDto,
} from './dto/create-sponsor.dto.js';

import type {
  UpdateSponsorDto,
} from './dto/update-sponsor.dto.js';

import type {
  CreateSponsorPlacementDto,
} from './dto/create-sponsor-placement.dto.js';

import type {
  UpdateSponsorPlacementDto,
} from './dto/update-sponsor-placement.dto.js';

import type {
  CreateSubscriptionPlanDto,
} from './dto/create-subscription-plan.dto.js';

import type {
  UpdateSubscriptionPlanDto,
} from './dto/update-subscription-plan.dto.js';

import type {
  GrantSubscriptionDto,
} from './dto/grant-subscription.dto.js';

@Injectable()
export class CommercialService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly authorization:
      AuthorizationService,
  ) {}

  async getOverview(
    userId: string,
  ) {
    await this.assertActiveUser(
      userId,
    );

    const [
      plans,
      membership,
      placements,
    ] =
      await Promise.all([
        this.activePlans(),
        this.membershipForUser(
          userId,
        ),
        this.activePlacements(),
      ]);

    return {
      success: true,

      data: {
        plans,
        membership,
        placements,
        billing: {
          checkoutAvailable:
            false,
          mode:
            'CATALOG_ONLY',
          message:
            'Online payment checkout is not enabled yet. FC Arena will only show a paid checkout after a payment provider is securely integrated.',
        },
      },

      error: null,
    };
  }

  async getPlans(
    userId: string,
  ) {
    await this.assertActiveUser(
      userId,
    );

    return {
      success: true,

      data: {
        plans:
          await this.activePlans(),

        billing: {
          checkoutAvailable:
            false,
          mode:
            'CATALOG_ONLY',
        },
      },

      error: null,
    };
  }

  async getMyMembership(
    userId: string,
  ) {
    await this.assertActiveUser(
      userId,
    );

    return {
      success: true,

      data:
        await this.membershipForUser(
          userId,
        ),

      error: null,
    };
  }

  async getPlacements(
    userId: string,
    rawKey?: string,
  ) {
    await this.assertActiveUser(
      userId,
    );

    const key =
      this.normalizePlacementKey(
        rawKey,
      );

    return {
      success: true,

      data: {
        placements:
          await this.activePlacements(
            key,
          ),
      },

      error: null,
    };
  }

  async adminOverview(
    userId: string,
  ) {
    await this.assertSuperAdmin(
      userId,
    );

    const now =
      new Date();

    const [
      sponsors,
      placements,
      plans,
      subscriptions,
    ] =
      await Promise.all([
        this.prisma.sponsor.findMany({
          include: {
            _count: {
              select: {
                placements:
                  true,
              },
            },
          },

          orderBy: {
            updatedAt:
              'desc',
          },

          take: 100,
        }),

        this.prisma.sponsorPlacement.findMany({
          include: {
            sponsor: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
                status: true,
                disclosureLabel:
                  true,
              },
            },
          },

          orderBy: [
            {
              isActive:
                'desc',
            },
            {
              priority:
                'desc',
            },
            {
              updatedAt:
                'desc',
            },
          ],

          take: 200,
        }),

        this.prisma.subscriptionPlan.findMany({
          include: {
            _count: {
              select: {
                subscriptions:
                  true,
              },
            },
          },

          orderBy: [
            {
              isActive:
                'desc',
            },
            {
              priceMinor:
                'asc',
            },
          ],
        }),

        this.prisma.userSubscription.findMany({
          include: {
            plan: {
              select: {
                id: true,
                code: true,
                name: true,
                audience:
                  true,
              },
            },

            user: {
              select: {
                id: true,
                fullName: true,

                player: {
                  select: {
                    playerCode:
                      true,

                    identity: {
                      select: {
                        inGameName:
                          true,
                      },
                    },
                  },
                },
              },
            },

            league: {
              select: {
                id: true,
                name: true,
                logoUrl: true,
              },
            },

            grantedBy: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },

          orderBy: {
            createdAt:
              'desc',
          },

          take: 200,
        }),
      ]);

    const activeSubscriptions =
      subscriptions.filter(
        (
          subscription,
        ) =>
          this.subscriptionActive(
            subscription,
            now,
          ),
      );

    return {
      success: true,

      data: {
        sponsors:
          sponsors.map(
            (
              sponsor,
            ) => ({
              ...sponsor,
              placements:
                sponsor
                  ._count
                  .placements,
              _count:
                undefined,
            }),
          ),

        placements:
          placements.map(
            (
              placement,
            ) => ({
              ...placement,
              currentlyVisible:
                this.placementVisible(
                  placement,
                  now,
                ),
            }),
          ),

        plans:
          plans.map(
            (
              plan,
            ) => ({
              ...plan,
              subscriptions:
                plan
                  ._count
                  .subscriptions,
              _count:
                undefined,
            }),
          ),

        subscriptions:
          subscriptions.map(
            (
              subscription,
            ) => ({
              ...subscription,
              active:
                this.subscriptionActive(
                  subscription,
                  now,
                ),
              owner:
                subscription.audience ===
                'USER'
                  ? {
                      type:
                        'USER',
                      id:
                        subscription
                          .user
                          ?.id ??
                        null,
                      name:
                        subscription
                          .user
                          ?.player
                          ?.identity
                          ?.inGameName ??
                        subscription
                          .user
                          ?.fullName ??
                        'Unavailable user',
                      playerCode:
                        subscription
                          .user
                          ?.player
                          ?.playerCode ??
                        null,
                    }
                  : {
                      type:
                        'LEAGUE',
                      id:
                        subscription
                          .league
                          ?.id ??
                        null,
                      name:
                        subscription
                          .league
                          ?.name ??
                        'Unavailable League',
                      playerCode:
                        null,
                    },
            }),
          ),

        totals: {
          sponsors:
            sponsors.length,
          activeSponsors:
            sponsors.filter(
              (
                sponsor,
              ) =>
                sponsor.status ===
                'ACTIVE',
            ).length,
          placements:
            placements.length,
          visiblePlacements:
            placements.filter(
              (
                placement,
              ) =>
                this.placementVisible(
                  placement,
                  now,
                ),
            ).length,
          plans:
            plans.length,
          activePlans:
            plans.filter(
              (
                plan,
              ) =>
                plan.isActive,
            ).length,
          activeSubscriptions:
            activeSubscriptions.length,
        },

        billing: {
          checkoutAvailable:
            false,
          provider:
            null,
          mode:
            'CATALOG_ONLY',
        },
      },

      error: null,
    };
  }

  async createSponsor(
    userId: string,
    dto:
      CreateSponsorDto,
  ) {
    await this.assertSuperAdmin(
      userId,
    );

    const sponsor =
      await this.prisma.sponsor.create({
        data: {
          name:
            dto.name.trim(),
          logoUrl:
            dto.logoUrl
              ?.trim() ||
            null,
          websiteUrl:
            dto.websiteUrl
              ?.trim() ||
            null,
          description:
            dto.description
              ?.trim() ||
            null,
          disclosureLabel:
            dto.disclosureLabel
              ?.trim() ||
            'Sponsored',
          status:
            dto.status ??
            'DRAFT',
          createdByUserId:
            userId,
        },
      });

    await this.audit(
      userId,
      'SPONSOR_CREATED',
      'Sponsor',
      sponsor.id,
      {
        name:
          sponsor.name,
        status:
          sponsor.status,
      },
    );

    return {
      success: true,

      data: {
        sponsor,
      },

      error: null,
    };
  }

  async updateSponsor(
    userId: string,
    sponsorId: string,
    dto:
      UpdateSponsorDto,
  ) {
    await this.assertSuperAdmin(
      userId,
    );

    await this.requireSponsor(
      sponsorId,
    );

    const sponsor =
      await this.prisma.sponsor.update({
        where: {
          id:
            sponsorId,
        },

        data: {
          name:
            dto.name
              ?.trim(),
          logoUrl:
            dto.logoUrl ===
            undefined
              ? undefined
              : dto.logoUrl
                  .trim() ||
                null,
          websiteUrl:
            dto.websiteUrl ===
            undefined
              ? undefined
              : dto.websiteUrl
                  .trim() ||
                null,
          description:
            dto.description ===
            undefined
              ? undefined
              : dto.description
                  .trim() ||
                null,
          disclosureLabel:
            dto.disclosureLabel ===
            undefined
              ? undefined
              : dto.disclosureLabel
                  .trim() ||
                'Sponsored',
          status:
            dto.status,
        },
      });

    await this.audit(
      userId,
      'SPONSOR_UPDATED',
      'Sponsor',
      sponsor.id,
      {
        status:
          sponsor.status,
      },
    );

    return {
      success: true,

      data: {
        sponsor,
      },

      error: null,
    };
  }

  async createPlacement(
    userId: string,
    dto:
      CreateSponsorPlacementDto,
  ) {
    await this.assertSuperAdmin(
      userId,
    );

    await this.requireSponsor(
      dto.sponsorId,
    );

    const dates =
      this.placementDates(
        dto.startsAt,
        dto.endsAt,
      );

    this.assertCtaPair(
      dto.ctaLabel,
      dto.ctaUrl,
    );

    const placement =
      await this.prisma.sponsorPlacement.create({
        data: {
          sponsorId:
            dto.sponsorId,
          key:
            dto.key,
          headline:
            dto.headline
              .trim(),
          body:
            dto.body
              ?.trim() ||
            null,
          ctaLabel:
            dto.ctaLabel
              ?.trim() ||
            null,
          ctaUrl:
            dto.ctaUrl
              ?.trim() ||
            null,
          rewardText:
            dto.rewardText
              ?.trim() ||
            null,
          termsUrl:
            dto.termsUrl
              ?.trim() ||
            null,
          priority:
            dto.priority ??
            0,
          startsAt:
            dates.startsAt,
          endsAt:
            dates.endsAt,
          isActive:
            dto.isActive ??
            false,
          createdByUserId:
            userId,
        },
      });

    await this.audit(
      userId,
      'SPONSOR_PLACEMENT_CREATED',
      'SponsorPlacement',
      placement.id,
      {
        sponsorId:
          placement.sponsorId,
        key:
          placement.key,
        isActive:
          placement.isActive,
      },
    );

    return {
      success: true,

      data: {
        placement,
      },

      error: null,
    };
  }

  async updatePlacement(
    userId: string,
    placementId: string,
    dto:
      UpdateSponsorPlacementDto,
  ) {
    await this.assertSuperAdmin(
      userId,
    );

    const current =
      await this.prisma.sponsorPlacement.findUnique({
        where: {
          id:
            placementId,
        },
      });

    if (
      !current
    ) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'SPONSOR_PLACEMENT_NOT_FOUND',

          message:
            'Sponsor placement could not be found.',
        },
      });
    }

    const dates =
      this.placementDates(
        dto.startsAt ??
          (
            current.startsAt
              ?.toISOString()
          ),
        dto.endsAt ??
          (
            current.endsAt
              ?.toISOString()
          ),
      );

    this.assertCtaPair(
      dto.ctaLabel ??
        current.ctaLabel ??
        undefined,
      dto.ctaUrl ??
        current.ctaUrl ??
        undefined,
    );

    const placement =
      await this.prisma.sponsorPlacement.update({
        where: {
          id:
            placementId,
        },

        data: {
          key:
            dto.key,
          headline:
            dto.headline
              ?.trim(),
          body:
            dto.body ===
            undefined
              ? undefined
              : dto.body
                  .trim() ||
                null,
          ctaLabel:
            dto.ctaLabel ===
            undefined
              ? undefined
              : dto.ctaLabel
                  .trim() ||
                null,
          ctaUrl:
            dto.ctaUrl ===
            undefined
              ? undefined
              : dto.ctaUrl
                  .trim() ||
                null,
          rewardText:
            dto.rewardText ===
            undefined
              ? undefined
              : dto.rewardText
                  .trim() ||
                null,
          termsUrl:
            dto.termsUrl ===
            undefined
              ? undefined
              : dto.termsUrl
                  .trim() ||
                null,
          priority:
            dto.priority,
          startsAt:
            dates.startsAt,
          endsAt:
            dates.endsAt,
          isActive:
            dto.isActive,
        },
      });

    await this.audit(
      userId,
      'SPONSOR_PLACEMENT_UPDATED',
      'SponsorPlacement',
      placement.id,
      {
        key:
          placement.key,
        isActive:
          placement.isActive,
      },
    );

    return {
      success: true,

      data: {
        placement,
      },

      error: null,
    };
  }

  async createPlan(
    userId: string,
    dto:
      CreateSubscriptionPlanDto,
  ) {
    await this.assertSuperAdmin(
      userId,
    );

    const code =
      dto.code
        .trim()
        .toUpperCase();

    const existing =
      await this.prisma.subscriptionPlan.findUnique({
        where: {
          code,
        },
      });

    if (
      existing
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'SUBSCRIPTION_PLAN_CODE_EXISTS',

          message:
            'A subscription plan already uses this code.',
        },
      });
    }

    const plan =
      await this.prisma.subscriptionPlan.create({
        data: {
          code,
          name:
            dto.name.trim(),
          description:
            dto.description
              ?.trim() ||
            null,
          audience:
            dto.audience,
          interval:
            dto.interval,
          priceMinor:
            dto.priceMinor,
          currency:
            dto.currency
              .trim()
              .toUpperCase(),
          features:
            this.cleanFeatures(
              dto.features,
            ) as any,
          isActive:
            dto.isActive ??
            false,
          createdByUserId:
            userId,
        },
      });

    await this.audit(
      userId,
      'SUBSCRIPTION_PLAN_CREATED',
      'SubscriptionPlan',
      plan.id,
      {
        code:
          plan.code,
        audience:
          plan.audience,
        priceMinor:
          plan.priceMinor,
        currency:
          plan.currency,
      },
    );

    return {
      success: true,

      data: {
        plan,
      },

      error: null,
    };
  }

  async updatePlan(
    userId: string,
    planId: string,
    dto:
      UpdateSubscriptionPlanDto,
  ) {
    await this.assertSuperAdmin(
      userId,
    );

    const plan =
      await this.requirePlan(
        planId,
      );

    const updated =
      await this.prisma.subscriptionPlan.update({
        where: {
          id:
            plan.id,
        },

        data: {
          name:
            dto.name
              ?.trim(),
          description:
            dto.description ===
            undefined
              ? undefined
              : dto.description
                  .trim() ||
                null,
          priceMinor:
            dto.priceMinor,
          currency:
            dto.currency
              ?.trim()
              .toUpperCase(),
          features:
            dto.features ===
            undefined
              ? undefined
              : this.cleanFeatures(
                  dto.features,
                ) as any,
          isActive:
            dto.isActive,
        },
      });

    await this.audit(
      userId,
      'SUBSCRIPTION_PLAN_UPDATED',
      'SubscriptionPlan',
      plan.id,
      {
        priceMinor:
          updated.priceMinor,
        currency:
          updated.currency,
        isActive:
          updated.isActive,
      },
    );

    return {
      success: true,

      data: {
        plan:
          updated,
      },

      error: null,
    };
  }

  async grantSubscription(
    adminUserId: string,
    dto:
      GrantSubscriptionDto,
  ) {
    await this.assertSuperAdmin(
      adminUserId,
    );

    const plan =
      await this.requirePlan(
        dto.planId,
      );

    if (
      plan.audience !==
      dto.audience
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'SUBSCRIPTION_AUDIENCE_MISMATCH',

          message:
            'The plan audience does not match the requested subscription owner.',
        },
      });
    }

    const target =
      await this.validateSubscriptionTarget(
        dto,
      );

    const now =
      new Date();

    const durationDays =
      dto.durationDays ??
      (
        plan.interval ===
        'MONTHLY'
          ? 30
          : 365
      );

    const periodEnd =
      new Date(
        now.getTime() +
          durationDays *
            24 *
            60 *
            60 *
            1000,
      );

    const existing =
      await this.prisma.userSubscription.findFirst({
        where: {
          planId:
            plan.id,

          ...(dto.audience ===
          'USER'
            ? {
                userId:
                  target.userId,
              }
            : {
                leagueId:
                  target.leagueId,
              }),

          status: {
            in: [
              'ACTIVE',
              'TRIALING',
            ],
          },

          OR: [
            {
              currentPeriodEnd:
                null,
            },
            {
              currentPeriodEnd: {
                gt:
                  now,
              },
            },
          ],
        },

        orderBy: {
          createdAt:
            'desc',
        },
      });

    if (
      existing
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'ACTIVE_SUBSCRIPTION_EXISTS',

          message:
            'This owner already has an active subscription for the selected plan.',
        },
      });
    }

    const subscription =
      await this.prisma.userSubscription.create({
        data: {
          planId:
            plan.id,
          audience:
            dto.audience,
          userId:
            target.userId,
          leagueId:
            target.leagueId,
          provider:
            'MANUAL_COMP',
          priceMinorSnapshot:
            plan.priceMinor,
          currencySnapshot:
            plan.currency,
          status:
            'ACTIVE',
          currentPeriodStart:
            now,
          currentPeriodEnd:
            periodEnd,
          grantedByUserId:
            adminUserId,
          note:
            dto.note
              ?.trim() ||
            'Complimentary FC Arena entitlement',
        },
      });

    await this.audit(
      adminUserId,
      'SUBSCRIPTION_GRANTED',
      'UserSubscription',
      subscription.id,
      {
        planId:
          plan.id,
        audience:
          subscription.audience,
        userId:
          subscription.userId,
        leagueId:
          subscription.leagueId,
        periodEnd:
          subscription.currentPeriodEnd,
      },
    );

    if (
      subscription.userId
    ) {
      await this.notifySubscription(
        subscription.userId,
        plan.name,
        subscription.id,
      );
    } else if (
      subscription.leagueId
    ) {
      const admins =
        await this.prisma.leagueAdmin.findMany({
          where: {
            leagueId:
              subscription.leagueId,
          },

          select: {
            userId: true,
          },
        });

      await Promise.all(
        admins.map(
          (
            admin,
          ) =>
            this.notifySubscription(
              admin.userId,
              plan.name,
              subscription.id,
            ),
        ),
      );
    }

    return {
      success: true,

      data: {
        message:
          'Complimentary subscription granted.',
        subscription,
      },

      error: null,
    };
  }

  async cancelSubscription(
    adminUserId: string,
    subscriptionId: string,
  ) {
    await this.assertSuperAdmin(
      adminUserId,
    );

    const subscription =
      await this.prisma.userSubscription.findUnique({
        where: {
          id:
            subscriptionId,
        },

        include: {
          plan: {
            select: {
              name: true,
            },
          },
        },
      });

    if (
      !subscription
    ) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'SUBSCRIPTION_NOT_FOUND',

          message:
            'Subscription could not be found.',
        },
      });
    }

    if (
      [
        'CANCELED',
        'EXPIRED',
      ].includes(
        subscription.status,
      )
    ) {
      return {
        success: true,

        data: {
          message:
            'Subscription is already inactive.',
          subscription,
        },

        error: null,
      };
    }

    const now =
      new Date();

    const updated =
      await this.prisma.userSubscription.update({
        where: {
          id:
            subscription.id,
        },

        data: {
          status:
            'CANCELED',
          currentPeriodEnd:
            now,
          cancelAtPeriodEnd:
            false,
        },
      });

    await this.audit(
      adminUserId,
      'SUBSCRIPTION_CANCELED',
      'UserSubscription',
      subscription.id,
      {
        audience:
          subscription.audience,
        userId:
          subscription.userId,
        leagueId:
          subscription.leagueId,
      },
    );

    if (
      subscription.userId
    ) {
      await this.notifySubscription(
        subscription.userId,
        subscription
          .plan
          .name +
          ' ended',
        subscription.id,
      );
    }

    return {
      success: true,

      data: {
        message:
          'Subscription canceled.',
        subscription:
          updated,
      },

      error: null,
    };
  }

  private async activePlans() {
    const plans =
      await this.prisma.subscriptionPlan.findMany({
        where: {
          isActive:
            true,
        },

        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          audience: true,
          interval: true,
          priceMinor: true,
          currency: true,
          features: true,
        },

        orderBy: [
          {
            audience:
              'asc',
          },
          {
            priceMinor:
              'asc',
          },
        ],
      });

    return plans.map(
      (
        plan,
      ) => ({
        ...plan,
        features:
          this.jsonStringArray(
            plan.features,
          ),
      }),
    );
  }

  private async membershipForUser(
    userId: string,
  ) {
    const now =
      new Date();

    const leagueRoles =
      await this.prisma.leagueAdmin.findMany({
        where: {
          userId,
        },

        select: {
          leagueId: true,
        },
      });

    const leagueIds =
      leagueRoles.map(
        (
          role,
        ) =>
          role.leagueId,
      );

    const subscriptions =
      await this.prisma.userSubscription.findMany({
        where: {
          OR: [
            {
              userId,
            },

            ...(leagueIds.length >
            0
              ? [
                  {
                    leagueId: {
                      in:
                        leagueIds,
                    },
                  },
                ]
              : []),
          ],
        },

        include: {
          plan: {
            select: {
              id: true,
              code: true,
              name: true,
              audience: true,
              interval: true,
              features: true,
            },
          },

          league: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
            },
          },
        },

        orderBy: {
          createdAt:
            'desc',
        },
      });

    return {
      subscriptions:
        subscriptions.map(
          (
            subscription,
          ) => ({
            id:
              subscription.id,
            audience:
              subscription.audience,
            status:
              subscription.status,
            provider:
              subscription.provider,
            currentPeriodStart:
              subscription.currentPeriodStart,
            currentPeriodEnd:
              subscription.currentPeriodEnd,
            cancelAtPeriodEnd:
              subscription.cancelAtPeriodEnd,
            priceMinorSnapshot:
              subscription.priceMinorSnapshot,
            currencySnapshot:
              subscription.currencySnapshot,
            active:
              this.subscriptionActive(
                subscription,
                now,
              ),

            plan: {
              ...subscription.plan,
              features:
                this.jsonStringArray(
                  subscription
                    .plan
                    .features,
                ),
            },

            league:
              subscription.league,
          }),
        ),

      activeUserSubscription:
        subscriptions.find(
          (
            subscription,
          ) =>
            subscription.userId ===
              userId &&
            this.subscriptionActive(
              subscription,
              now,
            ),
        )?.id ??
        null,

      administeredLeagueIds:
        leagueIds,
    };
  }

  private async activePlacements(
    key?:
      | 'DASHBOARD'
      | 'AWARDS'
      | 'LEAGUE_WAR'
      | 'DISCOVER',
  ) {
    const now =
      new Date();

    const placements =
      await this.prisma.sponsorPlacement.findMany({
        where: {
          isActive:
            true,

          ...(key
            ? {
                key,
              }
            : {}),

          sponsor: {
            status:
              'ACTIVE',
          },

          AND: [
            {
              OR: [
                {
                  startsAt:
                    null,
                },
                {
                  startsAt: {
                    lte:
                      now,
                  },
                },
              ],
            },

            {
              OR: [
                {
                  endsAt:
                    null,
                },
                {
                  endsAt: {
                    gt:
                      now,
                  },
                },
              ],
            },
          ],
        },

        include: {
          sponsor: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              websiteUrl: true,
              disclosureLabel:
                true,
            },
          },
        },

        orderBy: [
          {
            priority:
              'desc',
          },
          {
            updatedAt:
              'desc',
          },
        ],

        take: 12,
      });

    return placements.map(
      (
        placement,
      ) => ({
        id:
          placement.id,
        key:
          placement.key,
        headline:
          placement.headline,
        body:
          placement.body,
        ctaLabel:
          placement.ctaLabel,
        ctaUrl:
          placement.ctaUrl,
        rewardText:
          placement.rewardText,
        termsUrl:
          placement.termsUrl,
        disclosureLabel:
          placement.sponsor
            .disclosureLabel ||
          'Sponsored',
        sponsor:
          placement.sponsor,
      }),
    );
  }

  private placementVisible(
    placement:
      {
        isActive:
          boolean;
        startsAt:
          Date | null;
        endsAt:
          Date | null;
        sponsor:
          {
            status:
              string;
          };
      },
    now:
      Date,
  ) {
    return (
      placement.isActive &&
      placement.sponsor
        .status ===
        'ACTIVE' &&
      (
        !placement.startsAt ||
        placement.startsAt <=
          now
      ) &&
      (
        !placement.endsAt ||
        placement.endsAt >
          now
      )
    );
  }

  private subscriptionActive(
    subscription:
      {
        status:
          string;
        currentPeriodEnd:
          Date | null;
      },
    now:
      Date,
  ) {
    return (
      [
        'ACTIVE',
        'TRIALING',
      ].includes(
        subscription.status,
      ) &&
      (
        !subscription.currentPeriodEnd ||
        subscription.currentPeriodEnd >
          now
      )
    );
  }

  private placementDates(
    startsAtRaw?:
      string,
    endsAtRaw?:
      string,
  ) {
    const startsAt =
      startsAtRaw
        ? new Date(
            startsAtRaw,
          )
        : null;

    const endsAt =
      endsAtRaw
        ? new Date(
            endsAtRaw,
          )
        : null;

    if (
      startsAt &&
      endsAt &&
      endsAt <=
        startsAt
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'SPONSOR_PLACEMENT_PERIOD_INVALID',

          message:
            'Sponsor placement end time must be after its start time.',
        },
      });
    }

    return {
      startsAt,
      endsAt,
    };
  }

  private assertCtaPair(
    ctaLabel?:
      string,
    ctaUrl?:
      string,
  ) {
    if (
      Boolean(
        ctaLabel?.trim(),
      ) !==
      Boolean(
        ctaUrl?.trim(),
      )
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'SPONSOR_CTA_INCOMPLETE',

          message:
            'Sponsor CTA label and URL must be provided together.',
        },
      });
    }
  }

  private cleanFeatures(
    raw:
      string[],
  ) {
    return [
      ...new Set(
        raw
          .map(
            (
              feature,
            ) =>
              feature
                .trim(),
          )
          .filter(
            Boolean,
          ),
      ),
    ].slice(
      0,
      30,
    );
  }

  private async validateSubscriptionTarget(
    dto:
      GrantSubscriptionDto,
  ) {
    if (
      dto.audience ===
      'USER'
    ) {
      if (
        !dto.targetUserId ||
        dto.targetLeagueId
      ) {
        throw new ConflictException({
          success: false,
          data: null,

          error: {
            code:
              'SUBSCRIPTION_USER_TARGET_REQUIRED',

            message:
              'A USER subscription requires targetUserId only.',
          },
        });
      }

      const user =
        await this.prisma.user.findFirst({
          where: {
            id:
              dto.targetUserId,
            status:
              'ACTIVE',
          },

          select: {
            id: true,
          },
        });

      if (
        !user
      ) {
        throw new NotFoundException({
          success: false,
          data: null,

          error: {
            code:
              'SUBSCRIPTION_TARGET_USER_NOT_FOUND',

            message:
              'Active target user could not be found.',
          },
        });
      }

      return {
        userId:
          user.id,
        leagueId:
          null,
      };
    }

    if (
      !dto.targetLeagueId ||
      dto.targetUserId
    ) {
      throw new ConflictException({
        success: false,
        data: null,

        error: {
          code:
            'SUBSCRIPTION_LEAGUE_TARGET_REQUIRED',

          message:
            'A LEAGUE subscription requires targetLeagueId only.',
        },
      });
    }

    const league =
      await this.prisma.league.findUnique({
        where: {
          id:
            dto.targetLeagueId,
        },

        select: {
          id: true,
        },
      });

    if (
      !league
    ) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'SUBSCRIPTION_TARGET_LEAGUE_NOT_FOUND',

          message:
            'Target League could not be found.',
        },
      });
    }

    return {
      userId:
        null,
      leagueId:
        league.id,
    };
  }

  private async requireSponsor(
    sponsorId: string,
  ) {
    const sponsor =
      await this.prisma.sponsor.findUnique({
        where: {
          id:
            sponsorId,
        },
      });

    if (
      !sponsor
    ) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'SPONSOR_NOT_FOUND',

          message:
            'Sponsor could not be found.',
        },
      });
    }

    return sponsor;
  }

  private async requirePlan(
    planId: string,
  ) {
    const plan =
      await this.prisma.subscriptionPlan.findUnique({
        where: {
          id:
            planId,
        },
      });

    if (
      !plan
    ) {
      throw new NotFoundException({
        success: false,
        data: null,

        error: {
          code:
            'SUBSCRIPTION_PLAN_NOT_FOUND',

          message:
            'Subscription plan could not be found.',
        },
      });
    }

    return plan;
  }

  private normalizePlacementKey(
    rawKey?:
      string,
  ) {
    return [
      'DASHBOARD',
      'AWARDS',
      'LEAGUE_WAR',
      'DISCOVER',
    ].includes(
      rawKey ??
      '',
    )
      ? rawKey as
          | 'DASHBOARD'
          | 'AWARDS'
          | 'LEAGUE_WAR'
          | 'DISCOVER'
      : undefined;
  }

  private async assertSuperAdmin(
    userId: string,
  ) {
    if (
      !await this.authorization.isSuperAdmin(
        userId,
      )
    ) {
      throw new ForbiddenException({
        success: false,
        data: null,

        error: {
          code:
            'SUPER_ADMIN_REQUIRED',

          message:
            'FC Arena SUPER_ADMIN access is required.',
        },
      });
    }
  }

  private async assertActiveUser(
    userId: string,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id:
            userId,
        },

        select: {
          status:
            true,
        },
      });

    if (
      !user ||
      user.status !==
        'ACTIVE'
    ) {
      throw new ForbiddenException({
        success: false,
        data: null,

        error: {
          code:
            'ACTIVE_USER_REQUIRED',

          message:
            'An active FC Arena account is required.',
        },
      });
    }
  }

  private jsonStringArray(
    value:
      unknown,
  ) {
    return Array.isArray(
      value,
    )
      ? value.filter(
          (
            item,
          ): item is string =>
            typeof item ===
            'string',
        )
      : [];
  }

  private async audit(
    actorUserId:
      string,
    action:
      string,
    targetType:
      string,
    targetId:
      string,
    metadata:
      Record<
        string,
        unknown
      >,
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action,
        targetType,
        targetId,
        scopeType:
          'COMMERCIAL',
        scopeId:
          'GLOBAL',
        metadata:
          metadata as any,
      },
    });
  }

  private async notifySubscription(
    userId: string,
    planName: string,
    entityId: string,
  ) {
    const dedupeKey =
      `subscription-updated:${entityId}:${userId}`;

    await this.prisma.notification.upsert({
      where: {
        dedupeKey,
      },

      create: {
        userId,
        type:
          'SUBSCRIPTION_UPDATED',
        title:
          'FC Arena Membership Updated',
        message:
          `${planName}: your FC Arena membership entitlement was updated.`,
        href:
          '/membership',
        entityType:
          'Subscription',
        entityId,
        dedupeKey,
        eventAt:
          new Date(),
      },

      update: {
        message:
          `${planName}: your FC Arena membership entitlement was updated.`,
        eventAt:
          new Date(),
      },
    });
  }
}
