import { summarizeExperience } from '../../api/src/experience/experience-policy.ts';
export const emptyExperience = summarizeExperience([],0,false);
export function collectedDailyFixture(){const state=dailyFixture();return {...state,balance:10,streak:1,longestStreak:1,claimedToday:true,cycleCompleted:1,calendar:{...state.calendar,claims:[{day:state.today,coins:10,bonus:0,streak:1}]}};}
export function dailyFixture(){return {
  serverNow:'2026-11-03T12:00:00.000Z',today:'2026-11-03',nextResetAt:'2026-11-03T18:30:00.000Z',balance:0,streak:0,longestStreak:0,claimedToday:false,cycleCompleted:0,
  policy:{dailyCoins:10,bonusEvery:7,bonusCoins:30,timeZone:'Asia/Kolkata'},todayReward:{baseCoins:10,bonusCoins:0,totalCoins:10},
  calendar:{month:'2026-11',claims:[]},cosmetics:{background:'CLASSIC',badge:null},ledger:[],catalog:[
    {id:'MIDNIGHT_GRID',name:'Midnight Grid',kind:'BACKGROUND',price:70,description:'A blue stadium grid for your player card.',owned:false,equipped:false},
    {id:'ROYAL_STRIPE',name:'Royal Stripe',kind:'BACKGROUND',price:100,description:'A plum and gold edition of your player card.',owned:false,equipped:false},
    {id:'ARENA_SPARK',name:'Arena Spark',kind:'BADGE',price:50,description:'A decorative spark badge on your player card.',owned:false,equipped:false},
  ]};}
