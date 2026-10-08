import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { es } from '@payloadcms/translations/languages/es'
import { en } from '@payloadcms/translations/languages/en'
import { APP_NAME } from './lib/brand'

import { Tenants } from './collections/Tenants'
import { Users } from './collections/Users'
import { Patients } from './collections/Patients'
import { Appointments } from './collections/Appointments'
import { Visits } from './collections/Visits'
import { Invoices } from './collections/Invoices'
import { AuditLogs } from './collections/AuditLogs'
import { BookingRequests } from './collections/BookingRequests'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: `— ${APP_NAME}`,
    },
  },
  // Admin panel (super admin only) and server-side validation messages in Spanish.
  i18n: {
    supportedLanguages: { es, en },
    fallbackLanguage: 'es',
  },
  collections: [Tenants, Users, Patients, Appointments, Visits, Invoices, AuditLogs, BookingRequests],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URL || '',
  }),
  sharp,
  plugins: [],
  onInit: async (payload) => {
    // Deterministic backstop for the double-booking race: a partial UNIQUE index
    // on (tenant, doctor, start) limited to slot-occupying statuses. Two concurrent
    // bookings for the exact same slot can't both insert — one hits a duplicate key
    // and aborts. Terminal statuses are excluded, so rebooking a cancelled slot works.
    try {
      const model = payload.db.collections?.appointments
      if (model) {
        const native = model.collection
        // Drop a stale non-unique index with the same key pattern if present
        // (it would conflict with the partial unique index below).
        const existing = await native.indexes().catch(() => [] as any[])
        const stale = existing.find(
          (i: any) => i.name === 'tenant_1_doctor_1_start_1' && !i.unique,
        )
        if (stale) await native.dropIndex('tenant_1_doctor_1_start_1').catch(() => {})

        await native.createIndex(
          { tenant: 1, doctor: 1, start: 1 },
          {
            unique: true,
            name: 'uniq_active_slot',
            partialFilterExpression: { status: { $in: ['scheduled', 'checked-in'] } },
          },
        )
      }
    } catch (err) {
      payload.logger.error({ err }, 'Failed to create uniq_active_slot index')
    }
  },
})
