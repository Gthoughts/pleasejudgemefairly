import Link from 'next/link'
import { redirect } from 'next/navigation'
import ProjectsHeader from '@/components/ProjectsHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'

export const metadata = {
  title: 'Projects — pleasejudgemefairly',
}

type ProjectRow = {
  id: string
  title: string
  short_description: string
  status: string
  created_at: string
}

export default async function ProjectsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/signin?next=/projects')

  const isAdmin = isAdminEmail(user.email)

  const { data: projectsData } = await supabase
    .from('projects')
    .select('id, title, short_description, status, created_at')
    .order('created_at', { ascending: false })
    .returns<ProjectRow[]>()

  const projects = projectsData ?? []

  // Look up registration totals for each project via the SECURITY DEFINER
  // RPC. This avoids RLS leaking individual rows.
  const counts = new Map<string, number>()
  await Promise.all(
    projects.map(async (p) => {
      const { data } = await supabase.rpc('project_registration_count', {
        p_project_id: p.id,
      })
      const n = typeof data === 'number' ? data : Number(data ?? 0)
      counts.set(p.id, n)
    })
  )

  const statusBadge: Record<string, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-green-100 text-green-800' },
    paused: { label: 'Paused', className: 'bg-amber-100 text-amber-800' },
    completed: { label: 'Completed', className: 'bg-stone-200 text-stone-600' },
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
                Large-scale community projects with their own dedicated space.
                Read the vision, see the model, and register your interest.
                Nothing here takes any money — it&rsquo;s registration of
                interest only.
              </p>
            </div>
            {isAdmin && (
              <Link
                href="/projects/new"
                className="shrink-0 rounded bg-stone-900 text-stone-50 px-4 py-2 text-sm hover:bg-stone-700"
              >
                New project
              </Link>
            )}
          </div>

          {projects.length === 0 ? (
            <p className="mt-10 text-sm text-stone-500">
              {isAdmin ? (
                <>
                  No projects yet.{' '}
                  <Link
                    href="/projects/new"
                    className="underline hover:text-stone-800"
                  >
                    Create the first one.
                  </Link>
                </>
              ) : (
                <>No projects have been published yet.</>
              )}
            </p>
          ) : (
            <ul className="mt-8 divide-y divide-stone-200 border-y border-stone-200">
              {projects.map((p) => {
                const badge = statusBadge[p.status] ?? statusBadge.active
                const count = counts.get(p.id) ?? 0
                return (
                  <li key={p.id} className="py-5">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/projects/${p.id}`}
                        className="text-base font-medium text-stone-800 hover:underline"
                      >
                        {p.title}
                      </Link>
                      {p.status !== 'active' && (
                        <span
                          className={`shrink-0 rounded px-2 py-0.5 text-xs ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-stone-600">
                      {p.short_description}
                    </p>
                    <p className="mt-1 text-xs text-stone-400">
                      {count} {count === 1 ? 'person has' : 'people have'}{' '}
                      registered interest
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
