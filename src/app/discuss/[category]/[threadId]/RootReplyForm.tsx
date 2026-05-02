'use client'

import { useRef } from 'react'
import { createReplyAction } from '../../actions'

// Top-level reply form shown under the thread. Posts a reply with
// parent_post_id = null so it attaches directly to the thread rather than
// to another post.
export default function RootReplyForm({
  threadId,
  category,
}: {
  threadId: string
  category: string
}) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await createReplyAction(formData)
        formRef.current?.reset()
      }}
      className="mt-3 flex flex-col gap-2"
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="category" value={category} />
      {/* empty parent_post_id so the reply lands at the top level */}
      <input type="hidden" name="parent_post_id" value="" />
      <textarea
        name="content"
        required
        minLength={1}
        maxLength={20000}
        rows={4}
        placeholder="Write a reply"
        className="rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
      />
      <div>
        <button
          type="submit"
          className="rounded bg-stone-900 text-stone-50 px-3 py-1.5 text-sm hover:bg-stone-700"
        >
          Post reply
        </button>
      </div>
    </form>
  )
}
