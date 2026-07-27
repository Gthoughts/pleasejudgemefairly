import SiteFooter from '@/components/SiteFooter'
import SignInForm from './SignInForm'
import Link from 'next/link'

export const metadata = {
  title: 'Sign in — a place for you',
}

export default async function SignInPage(props: PageProps<'/signin'>) {
  const search = await props.searchParams
  const next = typeof search.next === 'string' ? search.next : '/'
  const authError =
    typeof search.auth_error === 'string' ? search.auth_error : null

  return (
    <>
      <main className="flex-1 px-4 sm:px-6 py-10 sm:py-16">
        <div className="mx-auto max-w-md">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          {authError && (
            <p
              role="alert"
              className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {authError}
            </p>
          )}
          <div className="mt-8">
            <SignInForm next={next} />
          </div>
          <p className="mt-6 text-sm text-stone-600">
            <Link
              href="/forgot-password"
              className="underline underline-offset-4 hover:text-stone-900"
            >
              Forgot your password?
            </Link>
          </p>
          <p className="mt-2 text-sm text-stone-600">
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
