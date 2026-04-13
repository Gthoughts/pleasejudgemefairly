import { flagBrokenLinkAction } from '../../actions'

// A small server-form button that lets any signed-in user report a
// broken link. One flag per user per resource (enforced by the
// flags_broken_link_unique_idx partial index). When alreadyFlagged is
// true the button is disabled so the user can see they have already
// reported it.
export default function BrokenLinkButton({
  resourceId,
  redirectTo,
  alreadyFlagged,
}: {
  resourceId: string
  redirectTo: string
  alreadyFlagged: boolean
}) {
  return (
    <form action={flagBrokenLinkAction} className="inline">
      <input type="hidden" name="resource_id" value={resourceId} />
      <input type="hidden" name="redirect_to" value={redirectTo} />
      <button
        type="submit"
        disabled={alreadyFlagged}
        className={
          alreadyFlagged
            ? 'rounded border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-400 cursor-default'
            : 'rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-600 hover:border-stone-500 hover:text-stone-900'
        }
      >
        {alreadyFlagged ? 'broken link reported' : 'report broken link'}
      </button>
    </form>
  )
}
