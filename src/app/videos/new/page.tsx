import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VideosHeader from '@/components/VideosHeader'
import {
  getActiveCategories,
  getActiveSubcategoriesForCategory,
} from '@/lib/videos/queries'
import type { VideoSubcategory } from '@/lib/videos/categories'
import NewVideoForm from './NewVideoForm'

export const metadata = {
  title: 'Add a video — a place for you',
}

export default async function NewVideoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin?next=/videos/new')

  const categories = await getActiveCategories(supabase)
  const subcatsByCategory: Record<string, VideoSubcategory[]> = {}
  await Promise.all(
    categories.map(async (c) => {
      subcatsByCategory[c.id] = await getActiveSubcategoriesForCategory(
        supabase,
        c.id
      )
    })
  )

  return (
    <>
      <VideosHeader />
      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <h1 className="text-xl font-semibold">Add a video</h1>
        <p className="mt-1 text-sm text-stone-600">
          Paste a link from anywhere, or upload once storage comes online. No
          usernames appear on videos; only your comments carry your name.
        </p>
        <div className="mt-6">
          <NewVideoForm
            categories={categories}
            subcatsByCategory={subcatsByCategory}
          />
        </div>
      </main>
    </>
  )
}
