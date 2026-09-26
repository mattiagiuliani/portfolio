import express from '../../../backend/node_modules/express/index.js'
import mongoose from '../../../backend/node_modules/mongoose/index.js'
import dotenv from '../../../backend/node_modules/dotenv/lib/main.js'
import { readFileSync } from 'node:fs'
import { profileCopy } from '../src/data/profileCopy.js'
import { getPublicSettings } from '../../../backend/src/controllers/publicController.js'
import publicRoutes from '../../../backend/src/routes/publicRoutes.js'
import postRoutes from '../../../backend/src/routes/postRoutes.js'
const env = dotenv.parse(readFileSync(new URL('../../../backend/.env.development', import.meta.url)))
mongoose.set('autoIndex', false)
mongoose.set('autoCreate', false)
await mongoose.connect(env.MONGODB_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000 })
const app = express()
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000')
  if (req.method !== 'GET') return res.status(405).json({ message: 'Read-only design preview' })
  next()
})
// Local editorial preview only: public Mongo content is never changed.
app.get('/api/settings', (req, res, next) => getPublicSettings(req, { json: (payload) => res.json({ ...payload, data: { ...payload.data, ...profileCopy } }) }, next))
app.use('/api/posts', postRoutes)
app.use('/api', publicRoutes)
app.listen(5000, '127.0.0.1', () => console.log('Read-only preview API ready on 5000'))
