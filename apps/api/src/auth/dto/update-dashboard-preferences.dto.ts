import { IsArray, IsIn, IsOptional } from 'class-validator';

export const DASHBOARD_SECTIONS = [
  'nextMatch',
  'league',
  'activeTournament',
  'stats',
  'quickActions',
  'activity',
] as const;

export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];

export class UpdateDashboardPreferencesDto {
  @IsOptional()
  @IsArray()
  @IsIn(DASHBOARD_SECTIONS, { each: true })
  hiddenSections?: DashboardSection[];
}
