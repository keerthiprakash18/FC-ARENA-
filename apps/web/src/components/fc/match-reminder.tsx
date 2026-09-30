'use client';
export function MatchReminder({title,scheduledAt,matchId}:{title:string;scheduledAt:string|null;matchId:string}) {
 if(!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) return null;
 function download(){
  const escape=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r/g,'');
  const stamp=(date:Date)=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const start=new Date(scheduledAt!);const end=new Date(start.getTime()+3600000);
  const body=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//FC ARENA//Match Reminder//EN','BEGIN:VEVENT',`UID:${matchId}@fcarena.in`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,`SUMMARY:${escape(title)}`,`URL:https://fcarena.in/matches/${encodeURIComponent(matchId)}`,'BEGIN:VALARM','TRIGGER:-PT30M','ACTION:DISPLAY','DESCRIPTION:FC ARENA match reminder','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
  const url=URL.createObjectURL(new Blob([body],{type:'text/calendar;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='fc-arena-match.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <button onClick={download} className="theme-secondary-button rounded-xl px-4 py-3 text-sm" title="Import into your calendar for a reminder 30 minutes before the match">Add calendar reminder</button>;
}
