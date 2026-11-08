export function readPenaltyScores(form: FormData, prefix = "") {
  const home = String(
    form.get(prefix ? `${prefix}HomePenaltyScore` : "homePenaltyScore") ?? "",
  ).trim();
  const away = String(
    form.get(prefix ? `${prefix}AwayPenaltyScore` : "awayPenaltyScore") ?? "",
  ).trim();
  return {
    ...(home ? { homePenaltyScore: Number(home) } : {}),
    ...(away ? { awayPenaltyScore: Number(away) } : {}),
  };
}

export function PenaltyInputs({
  home,
  away,
  prefix = "",
  homeScore,
  awayScore,
  values,
  onChange,
}: {
  home: string;
  away: string;
  prefix?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  values?: { homePenaltyScore: string; awayPenaltyScore: string };
  onChange?: (
    field: "homePenaltyScore" | "awayPenaltyScore",
    value: string,
  ) => void;
}) {
  return (
    <fieldset className="col-span-3 grid gap-3 rounded-xl border border-sky-400/20 p-4">
      <legend className="px-2 text-sm font-bold text-sky-300">
        Penalty shoot-out (if needed)
      </legend>
      <p className="text-xs leading-5 text-slate-400">
        Enter match goals above, including extra time. Add penalties separately
        only if the aggregate score or single-match final is tied. Away goals do
        not break a tie.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid min-w-0 gap-2 text-xs">
          {home} penalties
          <input
            name={prefix ? `${prefix}HomePenaltyScore` : "homePenaltyScore"}
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            {...(values
              ? {
                  value: values.homePenaltyScore,
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                    onChange?.("homePenaltyScore", e.target.value),
                }
              : { defaultValue: homeScore ?? "" })}
            className="min-w-0 rounded-lg border border-white/10 bg-[#080e15] px-3 py-2"
          />
        </label>
        <label className="grid min-w-0 gap-2 text-xs">
          {away} penalties
          <input
            name={prefix ? `${prefix}AwayPenaltyScore` : "awayPenaltyScore"}
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            {...(values
              ? {
                  value: values.awayPenaltyScore,
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                    onChange?.("awayPenaltyScore", e.target.value),
                }
              : { defaultValue: awayScore ?? "" })}
            className="min-w-0 rounded-lg border border-white/10 bg-[#080e15] px-3 py-2"
          />
        </label>
      </div>
    </fieldset>
  );
}
