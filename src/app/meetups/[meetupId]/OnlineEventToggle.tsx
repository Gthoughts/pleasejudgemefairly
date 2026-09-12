'use client'

// Small client component for the "Online event" checkbox on the manage page.
// It lives in its own client file because the manage page is a server
// component, and server components cannot pass event handlers (onChange) to
// elements. Keeps a hidden `is_online` input in sync so the form submits the
// correct value.

export default function OnlineEventToggle({ defaultOnline }: { defaultOnline: boolean }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <input
        type="checkbox"
        name="is_online_check"
        id="is_online_check"
        defaultChecked={defaultOnline}
        onChange={(e) => {
          const hiddenInput = e.currentTarget.form?.querySelector(
            'input[name="is_online"]'
          ) as HTMLInputElement | null
          if (hiddenInput) hiddenInput.value = e.currentTarget.checked ? 'true' : 'false'
        }}
        className="h-4 w-4"
      />
      <input
        type="hidden"
        name="is_online"
        defaultValue={defaultOnline ? 'true' : 'false'}
      />
      <label htmlFor="is_online_check" className="text-stone-700">
        Online event
      </label>
    </div>
  )
}
