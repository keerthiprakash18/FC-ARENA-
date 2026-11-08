"use client";
import { useEffect, useRef, useState } from 'react';
import { FcDialog } from '@/components/fc/fc-dialog';
import { authenticatedRequest } from '@/lib/auth-client';
import { adjacentMonth, monthCells, type DailyRewardsData } from '@/lib/daily-rewards';
import { errorMessage, type ApiData } from '@/lib/player-experience';

export function DailyRewards({userId,full=false}:{userId:string;full?:boolean}){
  const [record,setRecord]=useState<{owner:string;data:DailyRewardsData}|null>(null);
  const data=record?.owner===userId?record.data:null;
  const [month,setMonth]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false),[earned,setEarned]=useState(false);
  const [promptDay,setPromptDay]=useState(''),[dismissedDay,setDismissedDay]=useState('');
  const actionPending=useRef(false),reload=useRef<((force?:boolean)=>Promise<void>)|null>(null),activeOwner=useRef('');
  const revision=useRef(0),scope=useRef(0);
  useEffect(()=>{
    activeOwner.current=userId;scope.current++;revision.current++;actionPending.current=false;setBusy(false);setMessage('');setError('');setEarned(false);
    let active=true,pending:Promise<void>|null=null;
    const controller=new AbortController();
    const load=(force=false):Promise<void>=>{
      if(!active||navigator.onLine===false||document.visibilityState==='hidden')return Promise.resolve();
      if(pending&&!force)return pending;
      if(force)revision.current++;
      const version=revision.current;
      setRefreshing(true);
      const current=authenticatedRequest<ApiData<DailyRewardsData>>(`/experience/me/check-in${month?'?month='+encodeURIComponent(month):''}`,{signal:controller.signal})
        .then(response=>{if(active&&version===revision.current){setRecord({owner:userId,data:response.data});setError('');}})
        .catch(err=>{if(active&&version===revision.current&&!controller.signal.aborted)setError(errorMessage(err));})
        .finally(()=>{if(pending===current){pending=null;if(active)setRefreshing(false);}});
      pending=current;
      return pending;
    };
    reload.current=load;void load();
    const refresh=()=>{void load();};
    const timer=window.setInterval(refresh,60_000);
    window.addEventListener('focus',refresh);window.addEventListener('online',refresh);window.addEventListener('fc-arena:rewards-changed',refresh);
    document.addEventListener('visibilitychange',refresh);
    const channel=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel('fc-arena-rewards');
    if(channel)channel.onmessage=refresh;
    return()=>{active=false;activeOwner.current='';controller.abort();window.clearInterval(timer);
      window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);window.removeEventListener('fc-arena:rewards-changed',refresh);
      document.removeEventListener('visibilitychange',refresh);channel?.close();if(reload.current===load)reload.current=null;};
  },[userId,month]);
  useEffect(()=>{
    if(!data)return;
    // Relative server duration also works when the phone's clock is incorrect.
    const delay=Math.max(1000,Date.parse(data.nextResetAt)-Date.parse(data.serverNow)+1000);
    const timer=window.setTimeout(()=>void reload.current?.(),Math.min(delay,86_401_000));
    return()=>window.clearTimeout(timer);
  },[data]);
  const today=data?.today;
  useEffect(()=>{
    if(full||!today)return;
    let dismissed='';
    try{dismissed=sessionStorage.getItem(`fc-arena:daily-prompt:${userId}`)??'';}catch{}
    setDismissedDay(dismissed);setPromptDay(today);
  },[full,userId,today]);
  function dismissPrompt(){
    if(!data)return;
    setDismissedDay(data.today);
    try{sessionStorage.setItem(`fc-arena:daily-prompt:${userId}`,data.today);}catch{}
  }
  async function act(kind:'claim'|'purchase'|'equip',itemId?:string){
    if(actionPending.current||!data)return;
    actionPending.current=true;setBusy(true);setError('');setMessage('');setEarned(false);
    const owner=userId,generation=scope.current;revision.current++;
    const path=kind==='claim'?'check-in':`cosmetics/${kind}`;
    try{
      const response=await authenticatedRequest<ApiData<DailyRewardsData>>(`/experience/me/${path}${month?'?month='+encodeURIComponent(month):''}`,{
        method:kind==='equip'?'PATCH':'POST',body:JSON.stringify(kind==='claim'?{intent:'DAILY_CHECK_IN'}:{itemId}),
      });
      if(activeOwner.current!==owner||scope.current!==generation)return;
      revision.current++;
      setRecord({owner,data:response.data});
      const receipt=response.data.receipt;
      setMessage(kind==='claim'?(receipt?.alreadyApplied?'Today’s reward is already collected.':`+${receipt?.coins??0} Arena Coins collected${receipt?.bonus?' · includes your 7-day bonus':''}!`)
        :kind==='purchase'?(receipt?.alreadyApplied?'You already own this cosmetic.':'Cosmetic unlocked. Select Use to apply it.'):'Your player card has been updated.');
      setEarned(kind==='claim'&&!receipt?.alreadyApplied);
      window.dispatchEvent(new Event('fc-arena:rewards-changed'));
      if(kind==='equip')window.dispatchEvent(new Event('fc-arena:cosmetics-changed'));
      if(typeof BroadcastChannel!=='undefined'){const channel=new BroadcastChannel('fc-arena-rewards');channel.postMessage('changed');channel.close();}
    }catch(err){
      if(activeOwner.current===owner&&scope.current===generation){await reload.current?.(true);setError(errorMessage(err));}
    }finally{if(activeOwner.current===owner&&scope.current===generation){actionPending.current=false;setBusy(false);}}
  }
  const label=data?new Date(data.calendar.month+'-01T12:00:00Z').toLocaleDateString('en-IN',{month:'long',year:'numeric',timeZone:'UTC'}):'';
  const cells=data?monthCells(data.calendar.month):[];
  if(!full)return <FcDialog
    open={!!data&&!data.claimedToday&&promptDay===data.today&&dismissedDay!==data.today}
    title="Daily check-in" description="Your daily reward is ready. Collect coins and make your player card yours."
    className="daily-rewards daily-check-in-dialog" busy={busy}
    confirmLabel={`Collect today · +${data?.todayReward.totalCoins??10}`} cancelLabel="Not now"
    onConfirm={()=>void act('claim')} onCancel={dismissPrompt}
  >{data&&<div className="daily-popup-content">
    <div className="daily-popup-reward"><span aria-hidden="true">◉</span><strong>+{data.todayReward.totalCoins}</strong><span>Arena Coins</span></div>
    <p className="daily-note">{data.todayReward.bonusCoins?'Includes your 30 coin bonus for 7 consecutive days.':`Check in ${data.policy.bonusEvery} days in a row for ${data.policy.bonusCoins} bonus coins.`}</p>
    <ol className="daily-week" aria-label="Seven day bonus progress">{Array.from({length:7},(_,i)=><li key={i} className={i<data.cycleCompleted?'is-collected':''}><span>{i<data.cycleCompleted?'✓':i+1}</span><small>+{i===6?data.policy.dailyCoins+data.policy.bonusCoins:data.policy.dailyCoins}</small></li>)}</ol>
    {error&&<div role="alert" className="daily-error">{error} <button type="button" onClick={()=>void reload.current?.()}>Refresh rewards</button></div>}
  </div>}</FcDialog>;
  return <section id={full?'daily-check-in':undefined} className={`daily-rewards ${full?'is-full':'is-compact'}`} aria-label="Daily check-in rewards">
    <div className="daily-heading"><div><span className="daily-eyebrow">A LITTLE EVERY DAY</span><h2>Daily check-in</h2><p>Collect coins. Make your player card yours.</p></div>
      <div className="daily-wallet"><span aria-hidden="true">◉</span><strong>{data?.balance.toLocaleString()??'—'}</strong><small>Arena Coins</small></div></div>
    {error&&<div role="alert" className="daily-error">{error} <button type="button" onClick={()=>void reload.current?.()}>Refresh rewards</button></div>}
    {!data?<p role="status">{error?'Rewards will be available when your connection returns.':'Loading daily rewards…'}</p>:<>
      {!data.claimedToday&&<div className="daily-claim-row"><div><strong>{`Today: +${data.todayReward.totalCoins} coins`}</strong>
        <p>{data.claimedToday?'Come back after midnight IST for your next reward.':data.todayReward.bonusCoins?'Your 7-day bonus is ready to collect.':`+${data.policy.bonusCoins} extra coins every ${data.policy.bonusEvery} consecutive days.`}</p></div>
        <button type="button" className="daily-claim" disabled={busy} onClick={()=>void act('claim')}>{busy?'Please wait…':`Collect today · +${data.todayReward.totalCoins}`}</button></div>}
      <div className="daily-streak-meta"><span><b>{data.streak}</b> day daily streak</span><span>Best: {data.longestStreak} days</span></div>
      <ol className="daily-week" aria-label="Seven day bonus progress">{Array.from({length:7},(_,i)=><li key={i} className={i<data.cycleCompleted?'is-collected':''}><span>{i<data.cycleCompleted?'✓':i+1}</span><small title={i===6?'Includes the 30 coin streak bonus':undefined}>+{i===6?data.policy.dailyCoins+data.policy.bonusCoins:data.policy.dailyCoins}</small></li>)}</ol>
      <p role="status" className={`daily-receipt ${earned?'is-earned':''}`}>{message}</p>
      <div className="daily-detail-grid">
        <div className="daily-calendar-panel" aria-busy={refreshing}><div className="daily-calendar-heading"><button type="button" aria-label="Previous month" disabled={refreshing||busy||data.calendar.month<='2000-01'} onClick={()=>setMonth(adjacentMonth(data.calendar.month,-1))}>‹</button>
          <h3>{label}</h3><button type="button" aria-label="Next month" disabled={refreshing||busy||data.calendar.month>=data.today.slice(0,7)} onClick={()=>setMonth(adjacentMonth(data.calendar.month,1))}>›</button></div>
          <table className="daily-calendar" aria-label={`${label} check-in calendar`}><thead><tr>{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=><th scope="col" key={day}>{day}</th>)}</tr></thead>
            <tbody>{Array.from({length:cells.length/7},(_,row)=><tr key={row}>{cells.slice(row*7,row*7+7).map((day,i)=>{
              const claim=data.calendar.claims.find(claim=>claim.day===day);
              return <td key={day??i}>{day&&<time dateTime={day} className={`${claim?'is-collected':''} ${day===data.today?'is-today':''}`} aria-current={day===data.today?'date':undefined}
                aria-label={`${day}${claim?`, collected ${claim.coins} coins${claim.bonus?', includes bonus':''}`:day===data.today?', today':day>data.today?', upcoming':', not collected'}`}>
                  <span>{Number(day.slice(-2))}</span><small>{claim?'✓':day===data.today?'Today':'·'}</small></time>}</td>;
            })}</tr>)}</tbody></table>
          <p className="daily-note">Check-ins reset at 00:00 IST. Missing a day starts a new streak; your collected coins stay with you.</p>
        </div>
        <div className="daily-studio"><span className="daily-eyebrow">CARD STUDIO</span><h3>Earn it. Style it.</h3><p className="daily-note">Cosmetics appear on your profile and downloaded player card. Your match XP and rankings stay based on verified results.</p>
          {data.catalog.map(item=><article className="daily-cosmetic" key={item.id}><div className={`daily-swatch cosmetic-${item.id}`} aria-hidden="true">{item.kind==='BADGE'?'✦':'FC'}</div><div><h4>{item.name}</h4><p>{item.description}</p>
            <button type="button" aria-label={item.equipped?`${item.name} equipped`:item.owned?`Use ${item.name}`:`Unlock ${item.name} for ${item.price} coins`}
              disabled={busy||item.equipped||(!item.owned&&data.balance<item.price)} onClick={()=>void act(item.owned?'equip':'purchase',item.id)}>
              {item.equipped?'Equipped ✓':item.owned?'Use':`Unlock · ${item.price} coins`}</button></div></article>)}
          <div className="daily-reset-actions">{data.cosmetics.background!=='CLASSIC'&&<button type="button" disabled={busy} onClick={()=>void act('equip','CLASSIC')}>Use classic background</button>}
            {data.cosmetics.badge&&<button type="button" disabled={busy} onClick={()=>void act('equip','NONE_BADGE')}>Remove cosmetic badge</button>}</div>
        </div>
      </div>
      {full&&data.ledger.length>0&&<details className="daily-ledger"><summary>Recent coin activity</summary><ul>{data.ledger.map(entry=><li key={entry.id}><span>{entry.kind==='CHECK_IN'?'Daily check-in':'Cosmetic unlock'}<small>{new Date(entry.createdAt).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short'})}</small></span><b>{entry.delta>0?'+':''}{entry.delta} coins</b><span>Balance: {entry.balanceAfter}</span></li>)}</ul></details>}
    </>}
  </section>;
}
