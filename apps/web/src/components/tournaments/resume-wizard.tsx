'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {authenticatedRequest} from '@/lib/auth-client';
const routes:Record<string,string>={SETUP:'setup',TEAMS:'teams',GROUPS:'groups',FIXTURE_SETTINGS:'fixture-settings',FIXTURE_PREVIEW:'fixture-preview',QUALIFICATION:'qualification',REVIEW:'review'};
export function ResumeWizard({tournamentId}:{tournamentId:string}){
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function resume(){setBusy(true);setError('');try{const result=await authenticatedRequest<{data:{currentStep:string}}>(`/tournaments/${tournamentId}/wizard`);router.push(`/tournaments/${tournamentId}/wizard/${routes[result.data.currentStep]||'setup'}`);}catch{setError('Unable to resume. Please retry.');}finally{setBusy(false);}}
 return <div><button disabled={busy} className="theme-primary-button rounded-xl px-4 py-3 text-sm font-semibold" onClick={()=>void resume()}>{busy?'Opening saved step…':'Resume setup'}</button>{error&&<p role="alert" className="mt-1 text-sm">{error}</p>}</div>;
}
