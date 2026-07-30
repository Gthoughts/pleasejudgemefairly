import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VideosHeader from '@/components/VideosHeader'
import {
  getVideoById,
  getVideoComments,
  getOwnVideoVote,
  getOwnWatchState,
  canCurrentUserReport,
} from '@/lib/videos/queries'
import VideoPlayer from '../VideoPlayer'
import CommentThread from './CommentThread'
import NewCommentForm from './NewCommentForm'

// Single video detail page. Reached from swipe-up on the feed player
// or by direct URL. Shows the same player over a scrollable comments
// section beneath. Comment thread is a small reddit-style forum.

type Props = {
  params: Promise<{ videoId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { videoId } = await params
  const supabase = await createClient()
  const video = await getVideoById(supabase, videoId)
  return {
    title: video ? `${video.title} — Videos` : 'Video',
  }
}

export default async function VideoDetailPage({ params }: Props) {
  const { videoId } = await params
  const supabase = await createClient()
  const video = await getVideoById(supabase, videoId)
  if (!video) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const isSignedIn = !!user

  const [comments, ownVote, watch, canReport] = await Promise.all([
    getVideoComments(supabase, videoId),
    isSignedIn ? getOwnVideoVote(supabase, videoId) : Promise.resolve(null),
    isSignedIn
      ? getOwnWatchState(supabase, videoId)
      : Promise.resolve(null),
    isSignedIn ? canCurrentUserReport(supabase) : Promise.resolve(false),
  ])

  return (
    <>
      <VideosHeader />
      <div className="flex flex-col">
        <div className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-xs text-stone-600 sm:px-6">
          <Link href="/videos" className="hover:underline">
            ← back to feed
          </Link>
        </div>

        <div className="relative h-[70vh] w-full bg-black sm:h-[75vh]">
          <VideoPlayer
            video={video}
            active
            canReport={canReport}
            ownVote={ownVote}
            qualifiedAlready={watch?.qualified ?? false}
            isSignedIn={isSignedIn}
          />
        </div>

        <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Discussion
          </h2>
          {isSignedIn ? (
            <div className="mt-3">
              <NewCommentForm videoId={videoId} />
            </div>
          ) : (
            <div className="mt-3 rounded border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
              <Link href={`/signin?next=/videos/${videoId}`} className="underline">
                Sign in
              </Link>{' '}
              to join the discussion.
            </div>
          )}
          <div className="mt-4 border-t border-stone-200 pt-2">
            <CommentThread
              videoId={videoId}
              comments={comments}
              currentUserId={user?.id ?? null}
            />
          </div>
        </div>
      </div>
    </>
  )
}
