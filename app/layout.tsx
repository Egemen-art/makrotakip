import type { Metadata, Viewport } from 'next'
import './globals.css'
import Gezinti from '@/components/Gezinti'

export const metadata: Metadata = {
  title: 'Finans Takip',
  description: 'Kişisel finans defteri, kural seti ve portföy takibi',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className="min-h-screen antialiased">
        <Gezinti />
        <main className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-5 sm:px-6">
          {children}
        </main>
      </body>
    </html>
  )
}
