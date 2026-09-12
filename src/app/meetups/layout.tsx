// Shared layout for all /meetups pages. Places a full-screen background
// image (with the same soft white scrim used on the home page) behind every
// meetup page: the list, create, detail and manage pages. The fixed -z-10
// layers sit behind the page content, which keeps its own backgrounds/cards.
//
// The scrim is a horizontal gradient: stronger white down the centre column
// (where the text sits, so it stays readable) and lighter at the left/right
// edges (so the picture still shows through on the sides).

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
      {/* Readability scrim: stronger in the centre, lighter at the edges */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{
          background:
            'linear-gradient(to right, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.85) 28%, rgba(255,255,255,0.85) 72%, rgba(255,255,255,0.30) 100%)',
        }}
      />

      {children}
    </>
  )
}
