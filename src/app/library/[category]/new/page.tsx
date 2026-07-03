import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import LibraryHeader from '@/components/LibraryHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { getLibraryCategory } from '@/lib/library-categories'
import { isAdminEmail } from '@/lib/admin'
import NewResourceForm from './NewResourceForm'

export default async function NewResourcePage(
  props: PageProps<'/library/[category]/new'>
) {
  const { category } = await props.params
  const cat = getLibraryCategory(category)
  if (!cat) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/signin?next=/library/${category}/new`)
  }

  const isAdmin = isAdminEmail(user.email)

  return (
    <>
      <LibraryHeader />
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-stone-500">
            <Link
              href={`/library/${category}`}
              className="underline hover:text-stone-900"
            >
              ← {cat.name}
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            Submit a resource to {cat.name}
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            No affiliate links, no payment links, no promotional content. The
            automatic filter will hold anything that looks like money-making.
          </p>

          <NewResourceForm category={category} isAdmin={isAdmin} />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
