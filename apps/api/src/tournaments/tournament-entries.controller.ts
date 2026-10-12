import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import {
  FileInterceptor,
} from '@nestjs/platform-express';

import {
  memoryStorage,
} from 'multer';

import type {
  Request,
} from 'express';

import type {
  AccessTokenPayload,
} from '../auth/auth.types.js';

import {
  JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard.js';

import {
  BulkCreateTournamentEntriesDto,
} from './dto/bulk-create-tournament-entries.dto.js';

import {
  CreateTournamentEntryDto,
} from './dto/create-tournament-entry.dto.js';

import {
  ReorderTournamentEntriesDto,
} from './dto/reorder-tournament-entries.dto.js';

import {
  UpdateTournamentEntryDto,
} from './dto/update-tournament-entry.dto.js';

import {
  TournamentEntriesService,
} from './tournament-entries.service.js';

import {
  TournamentEntryLogoService,
} from './tournament-entry-logo.service.js';


type AuthenticatedRequest =
  Request & {
    user:
      AccessTokenPayload;
  };


@Controller()
@UseGuards(
  JwtAuthGuard,
)
export class TournamentEntriesController {
  constructor(
    private readonly tournamentEntriesService:
      TournamentEntriesService,

    private readonly tournamentEntryLogoService:
      TournamentEntryLogoService,
  ) {}


  @Get(
    'tournaments/:tournamentId/entries',
  )
  list(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'tournamentId',
    )
    tournamentId:
      string,
  ) {
    return this.tournamentEntriesService.listEntries(
      request.user.sub,
      tournamentId,
    );
  }


  @Post(
    'tournaments/:tournamentId/entries',
  )
  create(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'tournamentId',
    )
    tournamentId:
      string,

    @Body()
    dto:
      CreateTournamentEntryDto,
  ) {
    return this.tournamentEntriesService.createEntry(
      request.user.sub,
      tournamentId,
      dto,
    );
  }


  @Post(
    'tournaments/:tournamentId/entries/bulk',
  )
  bulkCreate(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'tournamentId',
    )
    tournamentId:
      string,

    @Body()
    dto:
      BulkCreateTournamentEntriesDto,
  ) {
    return this.tournamentEntriesService.bulkCreateEntries(
      request.user.sub,
      tournamentId,
      dto,
    );
  }


  @Patch(
    'tournaments/:tournamentId/entries/reorder',
  )
  reorder(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'tournamentId',
    )
    tournamentId:
      string,

    @Body()
    dto:
      ReorderTournamentEntriesDto,
  ) {
    return this.tournamentEntriesService.reorderEntries(
      request.user.sub,
      tournamentId,
      dto,
    );
  }


  @Patch(
    'tournaments/:tournamentId/entries/:registrationId',
  )
  update(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'tournamentId',
    )
    tournamentId:
      string,

    @Param(
      'registrationId',
    )
    registrationId:
      string,

    @Body()
    dto:
      UpdateTournamentEntryDto,
  ) {
    return this.tournamentEntriesService.updateEntry(
      request.user.sub,
      tournamentId,
      registrationId,
      dto,
    );
  }


  @Delete(
    'tournaments/:tournamentId/entries/:registrationId',
  )
  remove(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'tournamentId',
    )
    tournamentId:
      string,

    @Param(
      'registrationId',
    )
    registrationId:
      string,
  ) {
    return this.tournamentEntriesService.deleteEntry(
      request.user.sub,
      tournamentId,
      registrationId,
    );
  }


  @Post(
    'tournaments/:tournamentId/entries/:registrationId/logo',
  )
  @UseInterceptors(
    FileInterceptor(
      'logo',
      {
        storage:
          memoryStorage(),

        limits: {
          fileSize:
            2 * 1024 * 1024,
        },
      },
    ),
  )
  uploadLogo(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId:
      string,

    @Param('registrationId')
    registrationId:
      string,

    @UploadedFile()
    file:
      Express.Multer.File,
  ) {
    return this.tournamentEntryLogoService.uploadLogo(
      request.user.sub,
      tournamentId,
      registrationId,
      file,
    );
  }


  @Delete(
    'tournaments/:tournamentId/entries/:registrationId/logo',
  )
  removeLogo(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('tournamentId')
    tournamentId:
      string,

    @Param('registrationId')
    registrationId:
      string,
  ) {
    return this.tournamentEntryLogoService.removeLogo(
      request.user.sub,
      tournamentId,
      registrationId,
    );
  }

}