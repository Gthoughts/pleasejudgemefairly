import { notFound, redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'

// Short-link resolver: /m/<slug> -> /meetups/<id>.
// The canonical URL stays UUID-based; this route just looks up the
// meetup and redirects. It uses the service-role client because RLS
// on the meetups table gates reads on being signed in, and share
// links get opened by cold visitors who then hit signin further
// down. The slug -> id mapping is not sensitive; the destination
// page still enforces auth.
export default async function ShortLinkPage(props: PageProps<'/m/[slug]'>) {
  const { slug } = await props.params

  const service = createServiceClient()
  const { data: meetup } = await service
    .from('meetups')
    .select('id')
    .eq('slug', slug)
    .maybeSingle<{ id: string }>()

  if (!meetup) notFound()
  redirect(`/meetups/${meetup.id}`)
}
