/**
 * Assignment script — CLI wrapper for the 6-round algorithm.
 *
 * Run with: npm run assign
 * Optionally pass a date: npm run assign -- --date 2026-09-15
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { assignPlayers } from '../lib/assignPlayersLib'

dotenv.config()

async function main() {
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) {
    console.error('MONGODB_URI not set')
    process.exit(1)
  }

  let today = new Date()
  const dateArg = process.argv.find((a) => a.startsWith('--date=') || a === '--date')
  if (dateArg) {
    const val = dateArg.includes('=') ? dateArg.split('=')[1] : process.argv[process.argv.indexOf('--date') + 1]
    if (val) today = new Date(val)
  }

  await mongoose.connect(mongoUri)
  console.log('Connected to MongoDB')

  try {
    await assignPlayers(today)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
