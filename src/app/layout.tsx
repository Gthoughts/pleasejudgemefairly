import type { Metadata } from 'next'
import { Fraunces, Public_Sans } from 'next/font/google'
import './globals.css'
import { createClient } from '@/lib/supabase/server'
import { getInboxUnreadCount } from '@/lib/inbox'
import PushBadgeSetup from '@/components/PushBadgeSetup'
import ChatBubbleButton from '@/components/ChatBubbleButton'

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'a place for you',
  description:
    'A community commitment, written and voted through by the people, word by word. A duty we share, not a power we surrender.',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const unreadCount = user ? await getInboxUnreadCount(supabase) : 0

  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${publicSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ChatBubbleButton />
        <PushBadgeSetup signedIn={user !== null} unreadCount={unreadCount} />
      </body>
    </html>
  )
}
