import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, DM_Sans } from 'next/font/google'
import { headers } from 'next/headers'
import { ThemeProvider } from 'next-themes'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { THEME_IDS } from '@/lib/themes'
import { BRAND } from '@/lib/brand'
import { ThemeBackground } from '@/components/ui/theme-background'
import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-dm-sans',
  display: 'swap',
})

function resolveMetadataBase(): URL {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.MC_PUBLIC_BASE_URL,
    process.env.APP_URL,
    process.env.MISSION_CONTROL_PUBLIC_URL,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  for (const candidate of candidates) {
    try {
      return new URL(candidate)
    } catch {
      // Ignore invalid URL values and continue fallback chain.
    }
  }

  // Prevent localhost fallback in production metadata when env is unset.
  return new URL('https://mission-control.local')
}

const metadataBase = resolveMetadataBase()

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: BRAND.titleFull,
  description: 'ИИ-Ателье «Центр управления» — оркестрация AI-корпорации',
  metadataBase,
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    shortcut: ['/favicon.svg'],
  },
  openGraph: {
    title: BRAND.titleFull,
    description: 'ИИ-Ателье «Центр управления» — оркестрация AI-корпорации',
    images: [{ url: '/logo.svg', width: 240, height: 80, alt: BRAND.titleFull }],
    type: 'website',
    siteName: BRAND.name,
  },
  twitter: {
    card: 'summary_large_image',
    title: BRAND.titleFull,
    description: 'ИИ-Ателье «Центр управления» — оркестрация AI-корпорации',
    images: ['/logo.svg'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: BRAND.name,
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const nonce = (await headers()).get('x-nonce') || undefined
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className={`${jetbrainsMono.variable} ${dmSans.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        {/* Blocking script to set 'dark' class before first paint, preventing FOUC.
            Content is a static string literal — no user input, no XSS vector. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'void';var light=['light','paper'];if(light.indexOf(t)===-1)document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="void"
            themes={THEME_IDS}
            enableSystem={false}
            disableTransitionOnChange
          >
            <ThemeBackground />
            <div className="h-screen overflow-hidden bg-background text-foreground">
              {children}
            </div>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
