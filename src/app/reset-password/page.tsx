import SiteFooter from '@/components/SiteFooter'
import ResetPasswordForm from './ResetPasswordForm'

export const metadata = {
  title: 'Reset password — a place for you',
}

export default function ResetPasswordPage() {
  return (
    <>
      <main className="flex-1 px-4 sm:px-6 py-10 sm:py-16">
        <div className="mx-auto max-w-md">
          <h1 className="text-2xl font-semibold">Reset password</h1>
          <div className="mt-8">
            <ResetPasswordForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
