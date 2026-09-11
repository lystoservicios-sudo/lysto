import { JobQuotePanel } from '@/components/pricing/job-quote-panel'
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <JobQuotePanel jobId={id}/>}
