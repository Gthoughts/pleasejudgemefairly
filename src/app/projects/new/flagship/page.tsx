import Link from 'next/link'
import { redirect } from 'next/navigation'
import ProjectsHeader from '@/components/ProjectsHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'
import NewProjectForm from './NewProjectForm'

export const metadata = {
  title: 'New flagship project — pleasejudgemefairly',
}

export default async function NewFlagshipProjectPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/signin?next=/projects/new/flagship')
  if (!isAdminEmail(user.email)) redirect('/projects')

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
          <h1 className="mt-1 text-2xl font-semibold">New flagship project</h1>
          <p className="mt-2 text-sm text-stone-600">
            Admin-only. Define the project, its vision, the financial model,
            and the tier structure. No money is collected here — tiers are
            purely an expression-of-interest framework.
          </p>
          <div className="mt-8">
            <NewProjectForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
