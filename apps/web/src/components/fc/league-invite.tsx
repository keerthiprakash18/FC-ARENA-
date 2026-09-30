'use client';
import {useState} from 'react';
export function LeagueInvite({code,name}:{code:string;name:string}){
 const [message,setMessage]=useState('');
 async function copy(){try{await navigator.clipboard.writeText(code);setMessage('League code copied');}catch{setMessage('Copy the league code shown above.');}}
 async function share(){try{const text=`Join ${name} on FC ARENA. League code: ${code}`;if(navigator.share)await navigator.share({title:name,text,url:'https://fcarena.in/leagues'});else{await navigator.clipboard.writeText(`${text}\nhttps://fcarena.in/leagues`);setMessage('Invite copied');}}catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))setMessage('Use Copy code to invite a player.');}}
 return <section className="theme-panel rounded-xl p-4"><div className="flex flex-wrap items-center gap-3"><span className="flex-1 text-sm">Invite code <strong className="font-mono">{code}</strong></span><button onClick={()=>void copy()} className="theme-secondary-button rounded-lg px-4 text-sm">Copy code</button><button onClick={()=>void share()} className="theme-primary-button rounded-lg px-4 text-sm">Share invite</button></div><p role="status" className="text-sm">{message}</p></section>;
}
