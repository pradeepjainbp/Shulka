import { PartyForm } from '@/components/PartyForm'

type Props = { params: Promise<{ id: string }> }

export default async function NewPartyPage({ params }: Props) {
  const { id } = await params
  return <PartyForm businessId={id} />
}
