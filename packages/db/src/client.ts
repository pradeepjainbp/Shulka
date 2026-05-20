import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema/index'

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

function createDb(): DrizzleDb {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const sql = neon(url)
  return drizzle(sql, { schema })
}

// Lazy singleton — deferred until first property access so that importing this
// module in a test environment without DATABASE_URL does not throw at load time.
// The error is raised when db is actually used (inside a test body / handler).
let _db: DrizzleDb | undefined

export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    if (_db === undefined) _db = createDb()
    return Reflect.get(_db, prop, receiver)
  },
  // Required so drizzle-orm's is() dialect check walks the real prototype chain.
  // Without this, instanceof/prototype checks see Object.prototype and fail.
  getPrototypeOf(_target) {
    if (_db === undefined) _db = createDb()
    return Object.getPrototypeOf(_db)
  },
})

export type Db = typeof db
