// Shared layout for all /meetups pages. Places a full-screen background
// image (with the same soft white scrim used on the home page) behind every
// meetup page: the list, create, detail and manage pages. The fixed -z-10
// layers sit behind the page content, which keeps its own backgrounds/cards.

export default function MeetupsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Full-screen background image (same filter as the home page) */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/home/meetups-bg.png')" }}
      />
      {/* Soft scrim for readability */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-white/55" />

      {children}
    </>
  )
}
