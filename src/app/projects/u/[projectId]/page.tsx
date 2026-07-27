import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import ProjectsHeader from '@/components/ProjectsHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { categoryLabel } from '@/lib/user-projects/categories'
import { coerceStoredLinks } from '@/lib/user-projects/links'
import EditUserProjectForm from './EditUserProjectForm'
import UserProjectRootReplyForm from './UserProjectRootReplyForm'
import UserProjectPostItem from './UserProjectPostItem'

export const metadata = {
  title: 'Project — a place for you',
}

type UserProjectRow = {
  id: string
  creator_id: string
  parent_project_id: string | null
  title: string
  short_description: string
  description: string
  category: string
  links: unknown
  created_at: string
  updated_at: string
}

type ChildProject = {
  id: string
  title: string
  short_description: string
  category: string
  created_at: string
}

type ParentProject = {
  id: string
  title: string
}

type UserProjectPostRow = {
  id: string
  parent_post_id: string | null
  content: string
  author_id: string
  created_at: string
  hold_state: string
  author: { username: string } | null
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
      'id, creator_id, parent_project_id, title, short_description, description, category, links, created_at, updated_at'
    )
    .eq('id', projectId)
    .maybeSingle<UserProjectRow>()

  if (!project) notFound()

  const isCreator = project.creator_id === user.id
  const links = coerceStoredLinks(project.links)

  const [
    { data: creatorRow },
    { data: childrenRaw },
    { data: parentRaw },
    { data: postsRaw },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('username')
      .eq('id', project.creator_id)
      .maybeSingle<{ username: string }>(),
    supabase
      .from('user_projects')
      .select('id, title, short_description, category, created_at')
      .eq('parent_project_id', projectId)
      .order('created_at', { ascending: false })
      .returns<ChildProject[]>(),
    project.parent_project_id
      ? supabase
          .from('user_projects')
          .select('id, title')
          .eq('id', project.parent_project_id)
          .maybeSingle<ParentProject>()
      : Promise.resolve({ data: null as ParentProject | null }),
    supabase
      .from('user_project_posts')
      .select(
        'id, parent_post_id, content, author_id, created_at, hold_state, author:author_id(username)'
      )
      .eq('user_project_id', projectId)
      .order('created_at', { ascending: true })
      .limit(500)
      .returns<UserProjectPostRow[]>(),
  ])

  const children = childrenRaw ?? []
  const posts = postsRaw ?? []
  const parent = parentRaw ?? null

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

          {parent && (
            <p className="mt-2 text-xs text-stone-500">
              Sub-project of{' '}
              <Link
                href={`/projects/u/${parent.id}`}
                className="underline hover:text-stone-800"
              >
                {parent.title}
              </Link>
            </p>
          )}

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

          {links.length > 0 && (
            <section className="mt-10">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                Links
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {links.map((l, i) => (
                  <li key={i}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-stone-800 underline underline-offset-4 hover:text-stone-900"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-12">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                Sub-projects
                {children.length > 0 && (
                  <span className="ml-2 text-xs text-stone-400">
                    ({children.length})
                  </span>
                )}
              </h2>
              <Link
                href={`/projects/new?parent=${project.id}`}
                className="text-xs text-stone-600 underline hover:text-stone-900"
              >
                + add a sub-project
              </Link>
            </div>
            {children.length === 0 ? (
              <p className="mt-3 text-sm text-stone-500">None yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
                {children.map((c) => (
                  <li key={c.id} className="py-3">
                    <Link
                      href={`/projects/u/${c.id}`}
                      className="text-base text-stone-800 hover:underline"
                    >
                      {c.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {categoryLabel(c.category)}
                    </p>
                    <p className="mt-1 text-sm text-stone-600">
                      {c.short_description}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-12">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Discussion
              {posts.length > 0 && (
                <span className="ml-2 text-xs text-stone-400">
                  ({posts.length})
                </span>
              )}
            </h2>

            <UserProjectRootReplyForm userProjectId={project.id} />

            <div className="mt-6 divide-y divide-stone-200 border-t border-stone-200">
              {renderPostTree(posts, project.id, user.id, null, 0)}
              {posts.length === 0 && (
                <p className="py-4 text-sm text-stone-500">
                  Nothing yet — be the first to add something.
                </p>
              )}
            </div>
          </section>

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
                  initialLinks={links}
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

function renderPostTree(
  all: UserProjectPostRow[],
  userProjectId: string,
  currentUserId: string,
  parentId: string | null,
  depth: number
) {
  const children = all.filter((p) => (p.parent_post_id ?? null) === parentId)
  return children.map((post) => (
    <UserProjectPostItem
      key={post.id}
      post={post}
      userProjectId={userProjectId}
      depth={depth}
      currentUserId={currentUserId}
    >
      {renderPostTree(all, userProjectId, currentUserId, post.id, depth + 1)}
    </UserProjectPostItem>
  ))
}
