import SiteFooter from '@/components/SiteFooter'
import SignInForm from './SignInForm'
import Link from 'next/link'

export const metadata = {
  title: 'Sign in — pleasejudgemefairly',
}

export default async function SignInPage(props: PageProps<'/signin'>) {
  const search = await props.searchParams
  const next = typeof search.next === 'string' ? search.next : '/'

  return (
    <>
      <main className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-md">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <div className="mt-8">
            <SignInForm next={next} />
          </div>
          <p className="mt-6 text-sm text-stone-600">
            New here?{' '}
            <Link
              href="/signup"
              className="underline underline-offset-4 hover:text-stone-900"
            >
              Create an account
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
