import type { Metadata } from 'next'
import { AuthProvider } from '@/contexts/AuthContext'
import './globals.css'

export const metadata: Metadata = {
  title: 'Flezi sandbox',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0F172A] text-[#F8FAFC] antialiased h-screen overflow-hidden">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
