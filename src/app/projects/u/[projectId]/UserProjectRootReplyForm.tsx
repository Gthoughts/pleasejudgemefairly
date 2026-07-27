'use client'

import { useRef } from 'react'
import { createUserProjectPostAction } from '../../actions'
import PendingSubmitButton from '@/components/PendingSubmitButton'

export default function UserProjectRootReplyForm({
  userProjectId,
}: {
  userProjectId: string
}) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await createUserProjectPostAction(formData)
        formRef.current?.reset()
      }}
      className="mt-4 flex flex-col gap-2"
    >
      <input type="hidden" name="user_project_id" value={userProjectId} />
      <textarea
        name="content"
        required
        minLength={1}
        maxLength={20000}
        rows={4}
        placeholder="Add a message to this project"
        className="rounded border border-stone-300 px-3 py-2 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
      />
      <div>
        <PendingSubmitButton
          idle="Post"
          pending="Posting…"
          className="inline-flex items-center gap-2 rounded bg-stone-900 text-stone-50 px-3 py-1.5 text-sm hover:bg-stone-700 disabled:cursor-wait disabled:bg-stone-500"
        />
      </div>
    </form>
  )
}
