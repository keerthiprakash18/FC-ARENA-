'use client';
import { useState } from 'react';
import { FcActionButton } from './fc-action-button';
import { FcNotice } from './fc-ui';
export function ShareCard({title,lines,filename='fc-arena-card',label='Share player card'}:{title:string;lines:string[];filename?:string;label?:string}){
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [failed,setFailed]=useState(false);
 async function share(){if(busy)return;setBusy(true);setMessage('');setFailed(false);try{
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1080;const ctx=canvas.getContext('2d');if(!ctx)throw Error();
  ctx.fillStyle='#F6F4EE';ctx.fillRect(0,0,1080,1080);ctx.fillStyle='#102D4C';ctx.fillRect(0,0,1080,180);ctx.fillStyle='#D9B765';ctx.font='bold 44px sans-serif';ctx.fillText('FC ARENA',70,110);ctx.fillStyle='#102D4C';ctx.font='bold 52px sans-serif';ctx.fillText(title,70,280,940);ctx.font='32px sans-serif';lines.slice(0,8).forEach((line,i)=>ctx.fillText(line,70,380+i*68,940));ctx.font='24px sans-serif';ctx.fillText('fcarena.in',70,1010);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error()),'image/png'));const file=new File([blob],`${filename}.png`,{type:'image/png'});
  if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title});setMessage('Shared');}else{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Card downloaded');}
 }catch(error){if(!(error instanceof DOMException&&error.name==='AbortError')){setFailed(true);setMessage('Unable to share. Please try again.');}}finally{setBusy(false);}}
 return <div className="fc-share-card space-y-2"><FcActionButton busy={busy} busyLabel="Preparing card…" className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold" onClick={()=>void share()}>{label}</FcActionButton><FcNotice tone={failed?'error':'success'}>{message}</FcNotice></div>;
}
