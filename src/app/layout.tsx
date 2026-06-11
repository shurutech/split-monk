import type { Metadata, Viewport } from 'next'
import { Syne, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { Toaster } from '@/components/ui/sonner'

const syne = Syne({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-syne',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default:  'SplitMonk — Split bills. Stay friends.',
    template: '%s · SplitMonk',
  },
  description: 'Expense splitting for trips and groups. Track who paid, split fairly, settle up instantly.',
  manifest: '/manifest.json',
  openGraph: {
    title:       'SplitMonk — Split bills. Stay friends.',
    description: 'Expense splitting for trips and groups. Track who paid, split fairly, settle up instantly.',
    siteName:    'SplitMonk',
    type:        'website',
  },
  twitter: {
    card:        'summary',
    title:       'SplitMonk — Split bills. Stay friends.',
    description: 'Expense splitting for trips and groups.',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SplitMonk',
    startupImage: '/icons/apple-touch-icon.png',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
    icon:  [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#0A0A0B',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster position="bottom-right" theme="dark" />
      </body>
    </html>
  )
}
