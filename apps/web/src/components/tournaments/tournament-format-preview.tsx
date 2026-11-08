'use client';

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import type { TournamentFormatDescription } from '@/lib/tournament-format-guide';
import { buildTournamentFormatDiagram, layoutTournamentFormatDiagram } from '@/lib/tournament-format-diagram';

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia('(min-width: 1100px)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const wideScreen = () => window.matchMedia('(min-width: 1100px)').matches;

function wrapLabel(value: string, max = 26): string[] {
  const lines: string[] = [];
  for (const word of value.split(' ')) {
    const last = lines.length - 1;
    if (last >= 0 && lines[last].length + word.length + 1 <= max) lines[last] += ` ${word}`;
    else lines.push(word);
  }
  return lines;
}

function FormatDiagramImage({ guide, onClose }: { guide: TournamentFormatDescription; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null), closeRef = useRef<HTMLButtonElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const titleId = useId(), descriptionId = useId(), imageId = useId();
  const [zoom, setZoom] = useState(100);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const landscape = useSyncExternalStore(subscribeToWidth, wideScreen, () => false);
  const model = useMemo(() => buildTournamentFormatDiagram(guide), [guide]);
  const layout = useMemo(() => layoutTournamentFormatDiagram(model, landscape), [model, landscape]);
  const hasSecondChance = model.edges.some(edge => edge.secondChance);
  const fittedWidth = viewport.width ? landscape ? Math.min(viewport.width, viewport.height * layout.width / layout.height) : viewport.width : 0;

  useEffect(() => {
    const dialog = dialogRef.current, previous = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    dialog?.showModal(); closeRef.current?.focus(); document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close(); document.body.style.overflow = originalOverflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const width = element.clientWidth, height = element.clientHeight;
      setViewport(previous => previous.width === width && previous.height === height ? previous : { width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <dialog ref={dialogRef} className="fc-format-image-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}>
    <header className="fc-format-image-header">
      <div><p className="fc-format-eyebrow">{model.nodes.some(node => node.tone === 'champion') ? 'The road to the trophy' : 'Competition at a glance'}</p><h2 id={titleId}>Format diagram</h2><p className="fc-format-image-name">{guide.tournamentName || guide.title}</p></div>
      <button ref={closeRef} type="button" className="fc-format-icon-button" onClick={onClose} aria-label="Close format diagram"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
    </header>
    <p id={descriptionId} className="fc-format-image-description">{model.summary}</p>
    <div className="fc-format-image-toolbar">
      <p>{landscape ? 'Follow the arrows' : 'Scroll down to follow the stages'}</p>
      <div className="fc-format-zoom-controls" role="group" aria-label="Diagram zoom">
        <button type="button" className="fc-format-icon-button" aria-label="Zoom out" disabled={zoom <= 75} onClick={() => setZoom(value => Math.max(75, value - 25))}>−</button>
        <output aria-live="polite" aria-label="Zoom level">{zoom}%</output>
        <button type="button" className="fc-format-icon-button" aria-label="Zoom in" disabled={zoom >= 200} onClick={() => setZoom(value => Math.min(200, value + 25))}>+</button>
        <button type="button" className="fc-format-fit-button" onClick={() => { setZoom(100); viewportRef.current?.scrollTo({ top: 0, left: 0 }); }}>Fit</button>
      </div>
    </div>
    <div ref={viewportRef} className="fc-format-image-scroll" role="region" aria-label="Scrollable tournament format image" tabIndex={0}>
      <svg className="fc-format-graph" data-orientation={landscape ? 'landscape' : 'portrait'} role="img" aria-labelledby={`${imageId}-title`} aria-describedby={`${imageId}-description`}
        viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height}
        style={{ width: fittedWidth ? `${fittedWidth * zoom / 100}px` : `${zoom}%` }}>
        <title id={`${imageId}-title`}>{guide.title} progression diagram</title>
        <desc id={`${imageId}-description`}>{model.summary} {model.nodes.map(node => `${node.title}: ${node.value} ${node.unit}. ${node.detail.join('. ')}.`).join(' ')} {hasSecondChance ? 'Dashed arrows show qualifying-tie losers entering second chance.' : ''}</desc>
        <defs><marker id={`${imageId}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9 Z" fill="var(--theme-text-muted)" /></marker></defs>
        {layout.edges.map((edge, i) => <path key={`${edge.from}-${edge.to}`} d={edge.path} className="fc-format-flow-edge" data-tone={edge.tone}
          data-second-chance={edge.secondChance || undefined} markerEnd={`url(#${imageId}-arrow)`} style={{ '--flow-step': i } as CSSProperties} />)}
        {layout.nodes.map((node, index) => {
          const titleLines = wrapLabel(node.title, landscape ? 22 : 34);
          const details = node.detail.flatMap(line => wrapLabel(line, landscape ? 26 : 34));
          return <g key={node.id} transform={`translate(${node.x},${node.y})`} data-tone={node.tone} data-node={node.id} className="fc-format-flow-node" style={{ '--flow-step': Math.min(index, 8) } as CSSProperties}>
            <g className="fc-format-flow-node-content">
              <rect width={layout.nodeWidth} height={layout.nodeHeight} rx="16" className="fc-format-node-surface" />
              <rect x="0" y="16" width="4" height={layout.nodeHeight - 32} rx="2" className="fc-format-node-accent" />
              {node.tone === 'champion' ? <g transform={`translate(${layout.nodeWidth - 38}, 14)`} aria-hidden="true"><path d="M5 2h14v7a7 7 0 0 1-14 0V2Zm0 2H2v3a5 5 0 0 0 5 5m12-8h3v3a5 5 0 0 1-5 5m-5 4v5m-5 0h10" fill="none" stroke="var(--flow-ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></g> : null}
              <text x="16" y="24" className="fc-format-node-title">{titleLines.map((line, i) => <tspan x="16" dy={i ? 16 : 0} key={i}>{line}</tspan>)}</text>
              <text x="16" y={titleLines.length > 1 ? 74 : 62} className="fc-format-node-value" data-long={String(node.value).length > 5 || undefined}>{node.value}</text>
              <text x="16" y={titleLines.length > 1 ? 92 : 79} className="fc-format-node-unit">{node.unit}</text>
              <text x="16" y={titleLines.length > 1 ? 111 : 98} className="fc-format-node-detail">{details.slice(0, titleLines.length > 1 ? 1 : 2).map((line, i) => <tspan x="16" dy={i ? 15 : 0} key={i}>{line}</tspan>)}</text>
            </g>
          </g>;
        })}
      </svg>
    </div>
    <footer className="fc-format-image-footer">
      <div className="fc-format-image-key" aria-label="Diagram legend">{model.nodes.some(n => n.tone === 'direct') ? <span data-tone="direct">Direct / qualifying route</span> : null}{model.nodes.some(n => n.tone === 'playoff') ? <span data-tone="playoff">Play-off route</span> : null}{model.nodes.some(n => n.tone === 'out') ? <span data-tone="out">Eliminated</span> : null}{model.nodes.some(n => n.tone === 'champion') ? <span data-tone="champion">Winner</span> : null}{hasSecondChance ? <span className="fc-format-second-chance-key">Dashed arrow: second chance</span> : null}</div>
      <p>{model.note}</p>
      <details className="fc-format-image-text"><summary>Read diagram as text</summary><ol>{model.nodes.map(node => <li key={node.id}><strong>{node.title}: {node.value} {node.unit}</strong><p>{node.detail.join(' · ')}</p></li>)}</ol>{guide.note ? <p>{guide.note}</p> : null}{guide.knockoutRule ? <p>{guide.knockoutRule}</p> : null}</details>
    </footer>
  </dialog>;
}

export function TournamentFormatPreview({ guide }: { guide: TournamentFormatDescription }) {
  const [open, setOpen] = useState(false);
  const middle = guide.qualification.state === 'PENDING' ? 'Setup pending' : guide.qualification.total !== null ? `${guide.qualification.total} qualify` : guide.competitionFormat === 'CUSTOM_MANUAL' ? 'Custom rules' : 'Final table';
  return <>
    <button type="button" className="fc-format-preview-button" onClick={() => setOpen(true)} aria-haspopup="dialog">
      <span className="fc-format-preview-art" aria-hidden="true"><svg viewBox="0 0 80 52"><path d="M 16 26 H 37 M 37 26 V 10 H 62 M 37 26 V 42 H 62" /><rect x="2" y="16" width="24" height="20" rx="6" /><rect x="56" y="1" width="22" height="18" rx="5" /><rect x="56" y="33" width="22" height="18" rx="5" /></svg></span>
      <span className="fc-format-preview-copy"><strong>View format diagram</strong><span>{guide.approvedEntries} {guide.entryLabel} <span aria-hidden="true">→</span> {middle}<small>Stages, qualification &amp; the route to the trophy</small></span></span>
      <svg className="fc-format-preview-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>
    </button>
    {open ? <FormatDiagramImage guide={guide} onClose={() => setOpen(false)} /> : null}
  </>;
}
