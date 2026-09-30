'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
export function PlayerOnboarding({userId,profile,league,registered}:{userId:string;profile:boolean;league:boolean;registered:boolean}) {
 const [hidden,setHidden]=useState(true);
 const key=`fc-onboarding:${userId}`;
 useEffect(()=>{try{setHidden(localStorage.getItem(key)==='dismissed');}catch{setHidden(false);}},[key]);
 if(hidden || (profile&&league&&registered)) return null;
 const steps=[{done:profile,label:'Complete profile',href:'/profile'},{done:league,label:'Join a league',href:'/leagues'},{done:registered,label:'Register & play',href:'/tournaments'}];
 return <section className="theme-panel rounded-2xl p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Get match ready · {steps.filter(x=>x.done).length}/3</h2><button className="theme-secondary-button rounded-lg px-3 text-sm" onClick={()=>{setHidden(true);try{localStorage.setItem(key,'dismissed');}catch{}}}>Dismiss</button></div><div className="mt-4 grid gap-2 sm:grid-cols-3">{steps.map((step,i)=><Link key={step.href} href={step.href} className="theme-secondary-button rounded-xl p-3 text-sm">{step.done?'✓':`${i+1}.`} {step.label}</Link>)}</div></section>;
}
