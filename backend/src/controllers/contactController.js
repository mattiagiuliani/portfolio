import { validationResult } from 'express-validator'
import Contact from '../models/Contact.js'

export const submitContact = async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    })
  }

  try {
    const { name, email, message } = req.body
    const contact = await Contact.create({ name, email, message })

    res.status(201).json({
      success: true,
      message: 'Message received. I will get back to you soon!',
      id: contact._id,
    })
  } catch (err) {
    next(err)
  }
}
