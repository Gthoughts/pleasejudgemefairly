import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Short-link resolver: /m/<slug> -> /meetups/<id>.
// The canonical URL stays UUID-based; this route just looks up the
// meetup and redirects. Auth is not required here — the meetup page
// itself gates on signin.
export default async function ShortLinkPage(props: PageProps<'/m/[slug]'>) {
  const { slug } = await props.params

  const supabase = await createClient()
  const { data: meetup } = await supabase
    .from('meetups')
    .select('id')
    .eq('slug', slug)
    .maybeSingle<{ id: string }>()

  if (!meetup) notFound()
  redirect(`/meetups/${meetup.id}`)
}
