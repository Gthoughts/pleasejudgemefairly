import type { MetadataRoute } from 'next'

// Web App Manifest — served at /manifest.webmanifest. Governs the icon,
// name, and colours shown when a user installs the site to their
// home screen (iOS "Add to Home Screen" and Android/Chrome install).

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'a place for you',
    short_name: 'a place for you',
    description:
      'A community commitment, written and voted through by the people, word by word.',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf6f0',
    theme_color: '#faf6f0',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
