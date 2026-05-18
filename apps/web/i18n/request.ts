import { en } from '@shulka/i18n'
import { getRequestConfig } from 'next-intl/server'

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) ?? 'en'
  return {
    locale,
    messages: en,
  }
})
