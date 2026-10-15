import { CustomerPolicyArticle } from '@/components/customer/more/policy-article'
import { customerTermsPolicy } from '@/lib/legal/customer-account-policies'
export default function Page() { return <CustomerPolicyArticle policy={customerTermsPolicy} /> }
