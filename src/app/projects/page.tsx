import Link from 'next/link'
import { redirect } from 'next/navigation'
import ProjectsHeader from '@/components/ProjectsHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'
import {
  USER_PROJECT_CATEGORIES,
  categoryLabel,
} from '@/lib/user-projects/categories'

export const metadata = {
  title: 'Projects — a place for you',
}

type FlagshipRow = {
  id: string
  title: string
  short_description: string
  status: string
  created_at: string
}

type UserProjectRow = {
  id: string
  title: string
  short_description: string
  category: string
  created_at: string
  creator_id: string
}

export default async function ProjectsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/signin?next=/projects')

  const isAdmin = isAdminEmail(user.email)

  const [{ data: flagshipData }, { data: userProjectsData }] =
    await Promise.all([
      supabase
        .from('projects')
        .select('id, title, short_description, status, created_at')
        .order('created_at', { ascending: false })
        .returns<FlagshipRow[]>(),
      supabase
        .from('user_projects')
        .select(
          'id, title, short_description, category, created_at, creator_id'
        )
        .order('created_at', { ascending: false })
        .returns<UserProjectRow[]>(),
    ])

  const flagship = flagshipData ?? []
  const userProjects = userProjectsData ?? []

  const grouped = new Map<string, UserProjectRow[]>()
  for (const p of userProjects) {
    const list = grouped.get(p.category) ?? []
    list.push(p)
    grouped.set(p.category, list)
  }

  return (
    <>
      <ProjectsHeader />
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Projects</h1>
              <p className="mt-2 text-sm text-stone-600">
                A space for what people are working on — big or small. Share
                yours, or read about others.
              </p>
            </div>
            <Link
              href="/projects/new"
              className="shrink-0 rounded bg-stone-900 text-stone-50 px-4 py-2 text-sm hover:bg-stone-700"
            >
              Create a project
            </Link>
          </div>

          {isAdmin && (
            <p className="mt-4 text-xs text-stone-500">
              Admin:{' '}
              <Link
                href="/projects/new/flagship"
                className="underline hover:text-stone-800"
              >
                create a flagship project
              </Link>
            </p>
          )}

          {flagship.length > 0 && (
            <section className="mt-10">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                Flagship projects
              </h2>
              <ul className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
                {flagship.map((p) => (
                  <li key={p.id} className="py-5">
                    <Link
                      href={`/projects/${p.id}`}
                      className="text-base font-medium text-stone-800 hover:underline"
                    >
                      {p.title}
                    </Link>
                    <p className="mt-1 text-sm text-stone-600">
                      {p.short_description}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-12">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Community projects
            </h2>

            {userProjects.length === 0 ? (
              <p className="mt-4 text-sm text-stone-500">
                Nothing here yet.{' '}
                <Link
                  href="/projects/new"
                  className="underline hover:text-stone-800"
                >
                  Be the first.
                </Link>
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-8">
                {USER_PROJECT_CATEGORIES.map((c) => {
                  const list = grouped.get(c.value) ?? []
                  if (list.length === 0) return null
                  return (
                    <div key={c.value}>
                      <h3 className="text-sm font-medium text-stone-800">
                        {categoryLabel(c.value)}
                        <span className="ml-2 text-xs text-stone-500">
                          ({list.length})
                        </span>
                      </h3>
                      <ul className="mt-2 divide-y divide-stone-200 border-y border-stone-200">
                        {list.map((p) => (
                          <li key={p.id} className="py-4">
                            <Link
                              href={`/projects/u/${p.id}`}
                              className="text-base text-stone-800 hover:underline"
                            >
                              {p.title}
                            </Link>
                            <p className="mt-1 text-sm text-stone-600">
                              {p.short_description}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
