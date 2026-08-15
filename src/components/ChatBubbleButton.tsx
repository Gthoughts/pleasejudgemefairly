// Floating "open chat" button. Fixed bottom-right on every page via
// the root layout. Opens Campfire (self-hosted at chat.wrenbrmn.org)
// in a new tab. Anyone can see the button; whether they can join a
// room is enforced by Campfire itself.
export default function ChatBubbleButton() {
  return (
    <a
      href="https://chat.wrenbrmn.org"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open chat in a new tab"
      className="fixed bottom-5 right-5 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-stone-900 text-stone-50 shadow-lg ring-1 ring-stone-800/40 hover:bg-stone-700 hover:scale-105 transition sm:h-14 sm:w-14"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6 sm:h-7 sm:w-7"
        aria-hidden="true"
      >
        <path d="M20 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
      </svg>
    </a>
  )
}
