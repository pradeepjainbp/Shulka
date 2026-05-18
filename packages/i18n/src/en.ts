export const en = {
  app: { name: 'Shulka', tagline: 'GST + Finance for Indian MSMEs' },
  nav: {
    dashboard: 'Dashboard',
    invoices: 'Invoices',
    purchases: 'Purchases',
    reports: 'Reports',
    settings: 'Settings',
  },
  common: { loading: 'Loading...', error: 'Something went wrong', retry: 'Retry' },
} as const

export type Messages = typeof en
