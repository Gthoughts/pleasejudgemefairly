import Link from 'next/link'
import { redirect } from 'next/navigation'
import ProjectsHeader from '@/components/ProjectsHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import NewUserProjectForm from './NewUserProjectForm'

export const metadata = {
  title: 'New project — a place for you',
}

export default async function NewUserProjectPage(
  props: PageProps<'/projects/new'>
) {
  const search = await props.searchParams
  const parentId =
    typeof search.parent === 'string' && search.parent.length > 0
      ? search.parent
      : null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    const next = parentId
      ? `/projects/new?parent=${parentId}`
      : '/projects/new'
    redirect(`/signin?next=${encodeURIComponent(next)}`)
  }

  let parent: { id: string; title: string } | null = null
  if (parentId) {
    const { data } = await supabase
      .from('user_projects')
      .select('id, title')
      .eq('id', parentId)
      .maybeSingle<{ id: string; title: string }>()
    parent = data ?? null
  }

  return (
    <>
      <ProjectsHeader />
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-stone-500">
            <Link
              href={parent ? `/projects/u/${parent.id}` : '/projects'}
              className="underline hover:text-stone-900"
            >
              ← {parent ? parent.title : 'Projects'}
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            {parent ? `New sub-project of ${parent.title}` : 'New project'}
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Tell people what you&rsquo;re working on. It doesn&rsquo;t need
            to be big — a garden, a group, a workshop, a book. Anything
            you&rsquo;d like others to hear about.
          </p>
          <div className="mt-8">
            <NewUserProjectForm parentProjectId={parent?.id ?? null} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
