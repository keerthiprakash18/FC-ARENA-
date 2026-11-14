import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  MatchesModule,
} from '../matches/matches.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

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
  TournamentEntryLogoService,
} from './tournament-entry-logo.service.js';

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
  TournamentLogoService,
} from './tournament-logo.service.js';

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
import { TournamentToolsService } from './tournament-tools.service.js';
import { AchievementsModule } from '../achievements/achievements.module.js';
import { ResultsModule } from '../results/results.module.js';
import { TournamentReportService } from './tournament-report.service.js';
import { TournamentReportController } from './tournament-report.controller.js';
import { TournamentReportDownloadController } from './tournament-report-download.controller.js';
import { TournamentReportDownloadService } from './tournament-report-download.service.js';
import { TournamentGroupEditorService } from './tournament-group-editor.service.js';
import { TournamentGroupEditorController } from './tournament-group-editor.controller.js';
import { TournamentPlayerReplacementService } from './tournament-player-replacement.service.js';


import { SafeGroupEditorService } from './safe-group-editor.service.js';
import { TournamentFixtureResetService } from './tournament-fixture-reset.service.js';
import { TournamentDrawRestartService } from './tournament-draw-restart.service.js';

import { TournamentStudioController } from './tournament-studio.controller.js';
import { TournamentStudioService } from './tournament-studio.service.js';

@Module({
  imports: [
    AuthModule,
    MatchesModule,
    NotificationsModule,
    AchievementsModule,
    ResultsModule,
  ],

  controllers: [
    TournamentStudioController,
    TournamentsController,
    TournamentEntriesController,
    TournamentGroupsAdminController,
    TournamentFixtureWizardController,
    TournamentWizardFinalController,
    TournamentReportController,
    TournamentReportDownloadController,
    TournamentGroupEditorController,
  ],

  providers: [
    TournamentStudioService,
    SafeGroupEditorService,
    TournamentFixtureResetService,
    TournamentDrawRestartService,
    TournamentsService,
    TournamentEntriesService,
    TournamentPlayerReplacementService,
    TournamentEntryLogoService,
    FixturesService,
    TournamentGroupsService,
    TournamentLogoService,
    GroupFixturesService,
    PlayoffsService,
    TournamentFixtureWizardService,
    TournamentFixturePreviewService,
    TournamentWizardFinalizeService,
    TournamentToolsService,
    TournamentReportService,
    TournamentReportDownloadService,
    TournamentGroupEditorService,
  ],

  exports: [
    TournamentsService,
    TournamentEntriesService,
    TournamentPlayerReplacementService,
    TournamentEntryLogoService,
    FixturesService,
    TournamentGroupsService,
    GroupFixturesService,
    PlayoffsService,
    TournamentFixtureWizardService,
    TournamentFixturePreviewService,
    TournamentWizardFinalizeService,
    TournamentToolsService,
    TournamentReportService,
  ],
})
export class TournamentsModule {}
