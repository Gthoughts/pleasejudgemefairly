import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import LibraryHeader from '@/components/LibraryHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { getLibraryCategory } from '@/lib/library-categories'
import { submitResourceAction } from '../../actions'

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

  return (
    <>
      <LibraryHeader />
      <main className="flex-1 px-6 py-12">
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

          <form
            action={submitResourceAction}
            className="mt-8 flex flex-col gap-5"
          >
            <input type="hidden" name="category" value={category} />

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-stone-700">Link (URL)</span>
              <input
                name="url"
                type="url"
                required
                placeholder="https://"
                className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-stone-700">Title</span>
              <input
                name="title"
                required
                minLength={1}
                maxLength={300}
                className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-stone-700">
                Description{' '}
                <span className="font-normal text-stone-500">(max 500 characters)</span>
              </span>
              <textarea
                name="description"
                required
                minLength={1}
                maxLength={500}
                rows={5}
                className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </label>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded bg-stone-900 text-stone-50 px-4 py-2 hover:bg-stone-700"
              >
                Submit
              </button>
              <Link
                href={`/library/${category}`}
                className="text-sm text-stone-600 hover:underline"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
