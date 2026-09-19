import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  FixturesService,
} from './fixtures.service.js';

import {
  GroupFixturesService,
} from './group-fixtures.service.js';

import {
  PlayoffsService,
} from './playoffs.service.js';

import {
  TournamentEntriesController,
} from './tournament-entries.controller.js';

import {
  TournamentEntriesService,
} from './tournament-entries.service.js';

import {
  TournamentFixturePreviewService,
} from './tournament-fixture-preview.service.js';

import {
  TournamentFixtureWizardController,
} from './tournament-fixture-wizard.controller.js';

import {
  TournamentFixtureWizardService,
} from './tournament-fixture-wizard.service.js';

import {
  TournamentGroupsAdminController,
} from './tournament-groups-admin.controller.js';

import {
  TournamentGroupsService,
} from './tournament-groups.service.js';

import {
  TournamentsController,
} from './tournaments.controller.js';

import {
  TournamentsService,
} from './tournaments.service.js';

import {
  TournamentWizardFinalController,
} from './tournament-wizard-final.controller.js';

import {
  TournamentWizardFinalizeService,
} from './tournament-wizard-finalize.service.js';


@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    TournamentsController,
    TournamentEntriesController,
    TournamentGroupsAdminController,
    TournamentFixtureWizardController,
    TournamentWizardFinalController,
  ],

  providers: [
    TournamentsService,
    TournamentEntriesService,
    FixturesService,
    TournamentGroupsService,
    GroupFixturesService,
    PlayoffsService,
    TournamentFixtureWizardService,
    TournamentFixturePreviewService,
    TournamentWizardFinalizeService,
  ],

  exports: [
    TournamentsService,
    TournamentEntriesService,
    FixturesService,
    TournamentGroupsService,
    GroupFixturesService,
    PlayoffsService,
    TournamentFixtureWizardService,
    TournamentFixturePreviewService,
    TournamentWizardFinalizeService,
  ],
})
export class TournamentsModule {}