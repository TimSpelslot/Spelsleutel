import path from 'path'
import fs from 'fs'
import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/auth'

export const uploadRouter = Router()

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true)
    else cb(new Error('Only JPEG, PNG, WebP and GIF images are allowed.'))
  },
})

// POST /api/upload/image
uploadRouter.post('/image', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: 'No file uploaded' })
    return
  }
  const url = `/uploads/${req.file.filename}`
  res.json({ url })
})
