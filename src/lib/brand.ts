// Product identity in one place. The product name is configurable per deployment
// (NEXT_PUBLIC_APP_NAME) so the white-label / final name can change without a code
// hunt. Never hardcode the product name in UI strings — import from here.

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Consultorio'
export const APP_TAGLINE = 'Gestión simple para médicos independientes'
export const APP_LOCALE = 'es-DO'
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'soporte@example.com'

/** Original project credit (MIT license requires keeping the notice). */
export const BASED_ON = 'Basado en Matab (MIT)'
