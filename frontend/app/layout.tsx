import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OpenSandbox Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased h-screen overflow-hidden">
        {children}
      </body>
    </html>
  )
}
