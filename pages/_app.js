import '../styles/globals.css'
import { AuthProvider } from '../context/AuthContext'
import { UnitsProvider } from '../context/UnitsContext'
import { useEffect } from 'react'

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  return (
    <AuthProvider>
      <UnitsProvider>
        <Component {...pageProps} />
      </UnitsProvider>
    </AuthProvider>
  )
}
