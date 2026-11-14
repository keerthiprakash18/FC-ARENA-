'use client';

import { useState } from 'react';
import { FcActionButton } from './fc-action-button';
import { FcNotice } from './fc-ui';
import { authenticatedRequest } from '@/lib/auth-client';

export function LeagueInvite({ leagueId, code, name, canInvite }: {
  leagueId: string; code: string; name: string; canInvite: boolean;
}) {
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<'copy' | 'share' | 'qr' | null>(null);
  const [qr, setQr] = useState('');
  const [invite, setInvite] = useState<{ url: string; expiresAt: string } | null>(null);

  async function getInvite() {
    if (invite && Date.parse(invite.expiresAt) > Date.now()) return invite;
    const { data } = await authenticatedRequest<{ data: { token: string; expiresAt: string } }>(
      `/leagues/${leagueId}/invites`, { method: 'POST' },
    );
    const url = new URL('/leagues', window.location.origin);
    url.searchParams.set('invite', data.token);
    const next = { url: url.toString(), expiresAt: data.expiresAt };
    setInvite(next);
    return next;
  }

  async function copy() {
    if (busy) return;
    setBusy('copy'); setMessage(''); setFailed(false);
    try { await navigator.clipboard.writeText(code); setMessage('League code copied'); }
    catch { setFailed(true); setMessage('Copy the league code shown above.'); }
    finally { setBusy(null); }
  }
  async function share() {
    if (busy) return;
    setBusy('share'); setMessage(''); setFailed(false);
    try {
      const { url } = await getInvite();
      const text = `Request to join ${name} on FC ARENA. This invitation expires in up to 7 days.`;
      if (navigator.share) { await navigator.share({ title: name, text, url }); setMessage('Invite shared'); }
      else { await navigator.clipboard.writeText(`${text}\n${url}`); setMessage('Invite link copied'); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setFailed(true); setMessage(error instanceof Error ? error.message : 'Unable to share the invitation.');
      }
    } finally { setBusy(null); }
  }
  async function showQR() {
    if (busy) return;
    if (qr) { setQr(''); return; }
    setBusy('qr'); setMessage(''); setFailed(false);
    try {
      const { toDataURL } = await import('qrcode');
      const { url } = await getInvite();
      setQr(await toDataURL(url, { width: 280, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#102D4C', light: '#FFFFFF' } }));
    } catch { setFailed(true); setMessage('Unable to create QR code. Please use Share invite.'); }
    finally { setBusy(null); }
  }

  return (
    <section className="fc-league-invite theme-panel rounded-xl p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-full text-sm sm:w-auto sm:flex-1">Invite code <strong className="font-mono">{code}</strong></span>
        <FcActionButton busy={busy === 'copy'} busyLabel="Copying…" disabled={Boolean(busy)} onClick={() => void copy()} className="theme-secondary-button rounded-lg px-4 text-sm">Copy code</FcActionButton>
        {canInvite ? <>
          <FcActionButton busy={busy === 'share'} busyLabel="Sharing…" disabled={Boolean(busy)} onClick={() => void share()} className="theme-primary-button rounded-lg px-4 text-sm">Share 7-day invite</FcActionButton>
          <FcActionButton busy={busy === 'qr'} busyLabel="Creating…" disabled={Boolean(busy)} aria-expanded={Boolean(qr)} onClick={() => void showQR()} className="theme-secondary-button rounded-lg px-4 text-sm">{qr ? 'Hide QR' : 'Show invite QR'}</FcActionButton>
        </> : null}
      </div>
      {qr ? <div className="fc-interaction-reveal mt-4 grid justify-items-center gap-2">
        <img src={qr} width={280} height={280} alt={`Scan to join ${name}`} className="max-w-full rounded-xl" />
        <p className="text-sm">Scan and sign in to request membership. Expires {invite ? new Date(invite.expiresAt).toLocaleString() : ''}.</p>
        <a href={qr} download="fc-arena-league-invite.png" className="theme-secondary-button rounded-lg px-4 py-3 text-sm">Download QR</a>
      </div> : null}
      <div className={message ? 'mt-3' : ''}><FcNotice tone={failed ? 'error' : 'success'}>{message}</FcNotice></div>
    </section>
  );
}
