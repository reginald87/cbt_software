import './globals.css'
import localFont from 'next/font/local'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/contexts/AuthContext'
import ErrorBoundary from '@/components/dashboard/ErrorBoundary'
import Polyfills from '@/components/dashboard/Polyfills'

const inter = localFont({
  src: '../public/fonts/Inter-Variable.woff2',
  variable: '--font-inter',
  display: 'swap',
})

export const metadata = {
  title: 'BMU CBT System',
  description: 'Bayelsa Medical University Computer-Based Testing System',
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Polyfills />
        <ErrorBoundary>
          <AuthProvider>
            <div className="min-h-screen bg-gray-50">
              {children}
            </div>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#22c55e',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
