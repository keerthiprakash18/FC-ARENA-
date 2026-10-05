'use client';

export function AdminFilterBar({ query, onQueryChange, status, onStatusChange, count, statuses }: {
  query: string;
  onQueryChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  count: number;
  statuses: readonly string[];
}) {
  const filtered = Boolean(query.trim() || status);
  return (
    <section className="theme-panel fc-filter-bar rounded-2xl border p-4" aria-label="Review filters">
      <div className="fc-filter-controls">
        <label className="fc-field-label fc-filter-search">Search review queue
          <input type="search" value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Name, competition or reason" className="theme-input border px-3" />
        </label>
        <label className="fc-field-label">Review status
          <select value={status} onChange={event => onStatusChange(event.target.value)} className="theme-input border px-3">
            <option value="">All statuses</option>
            {statuses.map(value => <option key={value} value={value}>{value.toLowerCase().replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <button type="button" disabled={!filtered} onClick={() => { onQueryChange(''); onStatusChange(''); }} className="theme-secondary-button self-end rounded-[10px] border px-4 text-sm font-semibold">Reset filters</button>
      </div>
      <p role="status" className="theme-muted mt-3 text-xs">{count} {count === 1 ? 'result' : 'results'}{filtered ? ` · Active filters: ${status.toLowerCase() || 'all statuses'}${query.trim() ? ` · “${query.trim()}”` : ''}` : ' · Showing all reviews'}</p>
    </section>
  );
}
