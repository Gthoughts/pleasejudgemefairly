import SiteFooter from '@/components/SiteFooter'
import ForgotPasswordForm from './ForgotPasswordForm'
import Link from 'next/link'

export const metadata = {
  title: 'Forgot password — pleasejudgemefairly',
}

export default function ForgotPasswordPage() {
  return (
    <>
      <main className="flex-1 px-4 sm:px-6 py-10 sm:py-16">
        <div className="mx-auto max-w-md">
          <h1 className="text-2xl font-semibold">Forgot password</h1>
          <p className="mt-2 text-sm text-stone-600">
            Enter the email you signed up with and we&rsquo;ll send you a link
            to set a new password.
          </p>
          <div className="mt-8">
            <ForgotPasswordForm />
          </div>
          <p className="mt-6 text-sm text-stone-600">
            Remembered it?{' '}
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
