import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import ProjectsHeader from '@/components/ProjectsHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { categoryLabel } from '@/lib/user-projects/categories'
import EditUserProjectForm from './EditUserProjectForm'

export const metadata = {
  title: 'Project — a place for you',
}

type UserProjectRow = {
  id: string
  creator_id: string
  title: string
  short_description: string
  description: string
  category: string
  created_at: string
  updated_at: string
}

export default async function UserProjectPage(
  props: PageProps<'/projects/u/[projectId]'>
) {
  const { projectId } = await props.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/signin?next=/projects/u/${projectId}`)

  const { data: project } = await supabase
    .from('user_projects')
    .select(
      'id, creator_id, title, short_description, description, category, created_at, updated_at'
    )
    .eq('id', projectId)
    .maybeSingle<UserProjectRow>()

  if (!project) notFound()

  const isCreator = project.creator_id === user.id

  const { data: creatorRow } = await supabase
    .from('users')
    .select('username')
    .eq('id', project.creator_id)
    .maybeSingle<{ username: string }>()

  return (
    <>
      <ProjectsHeader />
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-stone-500">
            <Link href="/projects" className="underline hover:text-stone-900">
              ← Projects
            </Link>
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded bg-stone-100 text-stone-700 px-2 py-0.5 text-xs">
              {categoryLabel(project.category)}
            </span>
            <span className="text-xs text-stone-500">
              by {creatorRow?.username ?? 'someone'}
            </span>
          </div>

          <h1 className="mt-2 text-2xl font-semibold text-stone-900">
            {project.title}
          </h1>
          <p className="mt-2 text-base text-stone-700">
            {project.short_description}
          </p>

          <div className="prose prose-stone mt-8 max-w-none whitespace-pre-wrap text-stone-800">
            {project.description}
          </div>

          {isCreator ? (
            <div className="mt-12 border-t border-stone-200 pt-8">
              <h2 className="text-lg font-semibold text-stone-900">
                Edit your project
              </h2>
              <div className="mt-4">
                <EditUserProjectForm
                  projectId={project.id}
                  initialTitle={project.title}
                  initialShortDescription={project.short_description}
                  initialDescription={project.description}
                  initialCategory={project.category}
                />
              </div>
            </div>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
