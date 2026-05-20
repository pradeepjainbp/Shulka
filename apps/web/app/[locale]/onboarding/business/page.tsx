import { BusinessForm } from '@/components/BusinessForm'

export default function OnboardingBusinessPage() {
  return (
    <BusinessForm
      heading="Set up your first business"
      subheading="Tell us about your business to get started with GST management."
      redirectTo="/en/dashboard"
      submitLabel="Continue"
      bottomLink={{ href: '/en/dashboard', label: "I'll do this later" }}
    />
  )
}
