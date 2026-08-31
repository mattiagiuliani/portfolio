/**
 * One-time seed script — creates the initial admin account.
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=yourPassword node src/scripts/createAdmin.js
 *
 * Or set ADMIN_EMAIL / ADMIN_PASSWORD in your .env file.
 * Run once, then delete or restrict this script in production.
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import Admin from '../models/Admin.js'

const email    = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD
const name     = process.env.ADMIN_NAME     || 'Mattia Giuliani'

if (!process.env.MONGODB_URI || !email || !password) {
  console.error('❌  MONGODB_URI, ADMIN_EMAIL, and ADMIN_PASSWORD must be set')
  process.exit(1)
}

await mongoose.connect(process.env.MONGODB_URI)

const existing = await Admin.findOne({ email })
if (existing) {
  console.log(`ℹ️   Admin already exists: ${email}`)
  await mongoose.disconnect()
  process.exit(0)
}

await Admin.create({ name, email, password, role: 'super_admin' })

console.log(`✅  Admin created`)
console.log(`    Email:    ${email}`)

await mongoose.disconnect()
