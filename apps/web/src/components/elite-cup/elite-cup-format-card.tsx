'use client';

import {
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';
import {
  getEliteCupFormatDefinition,
  getEliteCupRecommendationMessage,
  getEliteCupRecommendedFormat,
  normalizeEliteCupFormat,
  savedEliteCupFormatMatchesRecommendation,
  type EliteCupFormat,
} from '@/lib/elite-cup-format';

interface EliteCupFormatCardProps {
  approvedTeams: number;
  savedFormat?: string | null;
  title?: string;
  className?: string;
}

export function EliteCupFormatCard({
  approvedTeams,
  savedFormat,
  title = 'Recommended competition format',
  className = '',
}: EliteCupFormatCardProps) {
  const recommendedFormat = getEliteCupRecommendedFormat(approvedTeams);
  const recommendation = getEliteCupFormatDefinition(recommendedFormat);
  const saved = normalizeEliteCupFormat(savedFormat);
  const hasSavedFormat = saved !== null;
  const matches = savedEliteCupFormatMatchesRecommendation(
    savedFormat,
    approvedTeams,
  );

  return (
    <FcPanel className={`overflow-hidden ${className}`}>
      <div className="border-b border-white/[0.07] bg-[linear-gradient(120deg,rgba(14,165,233,0.08),transparent_65%)] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-400">
              Elite Cup format guide
            </p>
            <h2 className="mt-2 text-xl font-black text-white">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {getEliteCupRecommendationMessage(approvedTeams)}
            </p>
          </div>

          <FcStatusBadge label="Dynamic recommendation" tone="cyan" />
        </div>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] sm:p-6">
        <div className="rounded-2xl border border-sky-400/25 bg-sky-400/[0.06] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                For {approvedTeams} approved {approvedTeams === 1 ? 'team' : 'teams'}
              </p>
              <p className="mt-2 text-2xl font-black text-sky-200">
                {recommendation.label}
              </p>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-sky-400/25 bg-sky-400/[0.08] text-xl text-sky-200" aria-hidden="true">
              {recommendedFormat === 'KNOCKOUT' ? '◇' : '↻'}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {recommendation.description}
          </p>
          <p className="mt-3 text-[11px] font-semibold text-sky-300">
            {recommendation.rangeLabel}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Saved format
          </p>
          <p className="mt-2 text-lg font-black text-slate-200">
            {hasSavedFormat
              ? getEliteCupFormatDefinition(saved as EliteCupFormat).label
              : 'Not set'}
          </p>
          {hasSavedFormat && !matches ? (
            <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-200" role="status">
              Saved format differs from the current recommendation for the approved team count.
            </p>
          ) : hasSavedFormat ? (
            <p className="mt-3 text-xs leading-5 text-emerald-300">
              Saved format matches the current recommendation.
            </p>
          ) : (
            <p className="mt-3 text-xs leading-5 text-slate-500">
              A saved format will appear here when the tournament has one.
            </p>
          )}
        </div>
      </div>
    </FcPanel>
  );
}
