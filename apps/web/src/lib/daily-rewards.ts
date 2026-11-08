export interface DailyRewardsData {
  serverNow:string; today:string; nextResetAt:string; balance:number; streak:number; longestStreak:number; claimedToday:boolean; cycleCompleted:number;
  policy:{dailyCoins:number;bonusEvery:number;bonusCoins:number;timeZone:string};
  todayReward:{baseCoins:number;bonusCoins:number;totalCoins:number};
  calendar:{month:string;claims:{day:string;coins:number;bonus:number;streak:number}[]};
  cosmetics:{background:string;badge:string|null};
  catalog:{id:string;name:string;description:string;kind:string;price:number;owned:boolean;equipped:boolean}[];
  ledger:{id:string;kind:string;delta:number;balanceAfter:number;createdAt:string}[];
  receipt?:{kind:string;alreadyApplied?:boolean;coins?:number;bonus?:number;itemId?:string};
}
export function monthCells(month:string){
  const [year,number]=month.split('-').map(Number),first=new Date(Date.UTC(year,number-1,1));
  const offset=(first.getUTCDay()+6)%7,days=new Date(Date.UTC(year,number,0)).getUTCDate();
  return Array.from({length:Math.ceil((offset+days)/7)*7},(_,index)=>index>=offset&&index<offset+days?`${month}-${String(index-offset+1).padStart(2,'0')}`:null);
}
export function adjacentMonth(month:string,delta:number){const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7);}
export function cosmeticPalette(id?:string){return id==='MIDNIGHT_GRID'?['#102b4a','#080f1b']:id==='ROYAL_STRIPE'?['#42203c','#160f24']:['#132e37','#080f1b'];}
export function cosmeticBadge(id?:string|null){return id==='ARENA_SPARK'?'Arena Spark':null;}
