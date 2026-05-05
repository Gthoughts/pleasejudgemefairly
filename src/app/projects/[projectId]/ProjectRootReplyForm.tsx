'use client'

import { useRef } from 'react'
import { createProjectPostAction } from '../actions'

export default function ProjectRootReplyForm({
  projectId,
  updateId,
  placeholder = 'Write a message',
}: {
  projectId: string
  updateId?: string | null
  placeholder?: string
}) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await createProjectPostAction(formData)
        formRef.current?.reset()
      }}
      className="mt-3 flex flex-col gap-2"
    >
      <input type="hidden" name="project_id" value={projectId} />
      {updateId !== undefined && (
        <input type="hidden" name="update_id" value={updateId ?? ''} />
      )}
      <input type="hidden" name="parent_post_id" value="" />
      <textarea
        name="content"
        required
        minLength={1}
        maxLength={20000}
        rows={4}
        placeholder={placeholder}
        className="rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
      />
      <div>
        <button
          type="submit"
          className="rounded bg-stone-900 text-stone-50 px-3 py-1.5 text-sm hover:bg-stone-700"
        >
          Post
        </button>
      </div>
    </form>
  )
}
