import { CustomerPolicyArticle } from '@/components/customer/more/policy-article'
import { customerPrivacyPolicy } from '@/lib/legal/customer-account-policies'
export default function Page() { return <CustomerPolicyArticle policy={customerPrivacyPolicy} /> }
