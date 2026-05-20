import { auth } from '@/auth'
import { EditBusinessForm } from '@/components/EditBusinessForm'
import { businesses, db } from '@shulka/db'
import { and, eq, isNull } from 'drizzle-orm'
import { redirect } from 'next/navigation'

type Props = { params: Promise<{ id: string }> }

export default async function EditBusinessPage({ params }: Props) {
  const [session, { id }] = await Promise.all([auth(), params])
  if (!session) redirect('/en/sign-in')

  const [biz] = await db
    .select()
    .from(businesses)
    .where(
      and(
        eq(businesses.id, id),
        eq(businesses.ownerUserId, session.user.id),
        isNull(businesses.deletedAt),
      ),
    )
    .limit(1)

  if (!biz) redirect('/en/businesses')

  return <EditBusinessForm business={biz} />
}
