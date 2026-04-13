import SiteFooter from '@/components/SiteFooter'
import SignUpForm from './SignUpForm'
import Link from 'next/link'

export const metadata = {
  title: 'Sign up — pleasejudgemefairly',
}

export default function SignUpPage() {
  return (
    <>
      <main className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-md">
          <h1 className="text-2xl font-semibold">Sign up</h1>
          <p className="mt-2 text-sm text-stone-600">
            Username, email, password. Email is verified; it is never shown.
          </p>
          <div className="mt-8">
            <SignUpForm />
          </div>
          <p className="mt-6 text-sm text-stone-600">
            Already have an account?{' '}
            <Link
              href="/signin"
              className="underline underline-offset-4 hover:text-stone-900"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
