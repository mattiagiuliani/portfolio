import { Router } from 'express'
import { body } from 'express-validator'
import { submitContact } from '../controllers/contactController.js'

const router = Router()

// Validation rules run before the controller
const validateContact = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),

  body('message')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 10 }).withMessage('Message must be at least 10 characters')
    .isLength({ max: 2000 }).withMessage('Message cannot exceed 2000 characters'),
]

router.post('/', validateContact, submitContact)

export default router
