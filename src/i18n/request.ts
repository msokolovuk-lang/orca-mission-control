import { getRequestConfig } from 'next-intl/server'
import { locales, defaultLocale, type Locale } from './config'

export default getRequestConfig(async () => {
  // Runtime is ru-only for now; ignore stale NEXT_LOCALE cookies.
  const locale: Locale = locales.length === 1 ? locales[0] : defaultLocale

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
