import {
  IsIn,
} from 'class-validator';

export class UpdateTournamentWizardStepDto {
  @IsIn([
    'SETUP',
    'TEAMS',
    'GROUPS',
    'FIXTURE_SETTINGS',
    'FIXTURE_PREVIEW',
    'QUALIFICATION',
    'REVIEW',
  ])
  step!:
    | 'SETUP'
    | 'TEAMS'
    | 'GROUPS'
    | 'FIXTURE_SETTINGS'
    | 'FIXTURE_PREVIEW'
    | 'QUALIFICATION'
    | 'REVIEW';
}