import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import DiscussHeader from '@/components/DiscussHeader'
import SiteFooter from '@/components/SiteFooter'
import { getCategory } from '@/lib/categories'
import { createClient } from '@/lib/supabase/server'
import { createThreadAction } from '../../actions'

export default async function NewThreadPage(
  props: PageProps<'/discuss/[category]/new'>
) {
  const { category } = await props.params
  const cat = getCategory(category)
  if (!cat) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/signin?next=/discuss/${category}/new`)
  }

  return (
    <>
      <DiscussHeader />
      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm text-stone-500">
            <Link
              href={`/discuss/${category}`}
              className="underline hover:text-stone-900"
            >
              ← {cat.name}
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            New thread in {cat.name}
          </h1>

          <form action={createThreadAction} className="mt-8 flex flex-col gap-4">
            <input type="hidden" name="category" value={category} />

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-stone-700">Title</span>
              <input
                name="title"
                required
                minLength={1}
                maxLength={200}
                className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-stone-700">Body</span>
              <textarea
                name="content"
                required
                minLength={1}
                maxLength={20000}
                rows={12}
                className="rounded border border-stone-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
            </label>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded bg-stone-900 text-stone-50 px-4 py-2 hover:bg-stone-700"
              >
                Post thread
              </button>
              <Link
                href={`/discuss/${category}`}
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
