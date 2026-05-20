import { BusinessForm } from '@/components/BusinessForm'

export default function NewBusinessPage() {
  return (
    <BusinessForm
      heading="Add Business"
      subheading="Enter your business details to get started."
      redirectTo="/en/businesses"
      topLink={{ href: '/en/dashboard', label: '← Back to Dashboard' }}
    />
  )
}
