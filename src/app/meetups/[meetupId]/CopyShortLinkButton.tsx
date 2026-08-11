'use client'

import { useState } from 'react'

export default function CopyShortLinkButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)

  async function onClick() {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://wrenbrmn.org'
    const url = `${origin}/m/${slug}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded border border-stone-300 px-2.5 py-1 text-xs text-stone-600 hover:border-stone-500 hover:text-stone-900"
      title={`Share wrenbrmn.org/m/${slug}`}
    >
      {copied ? 'Copied' : `Share link: /m/${slug}`}
    </button>
  )
}
