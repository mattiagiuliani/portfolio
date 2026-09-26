import mongoose from 'mongoose'

// Every Mongoose operation in the controller (including the outbox insert)
// inherits the transaction session. Requires MongoDB replica set / Atlas.
mongoose.set('transactionAsyncLocalStorage', true)

export const publicationTransaction = (handler) => async (req, res, next) => {
  try {
    const result = await mongoose.connection.transaction(async () => {
      let payload
      let status = 200
      let failure
      const response = {
        status(code) { status = code; return this },
        json(value) { payload = value; return this },
      }
      await handler(req, response, (error) => { failure = error })
      if (failure) throw failure
      if (payload === undefined) throw new Error('Publication mutation produced no response')
      return { status, payload }
    })
    // Never acknowledge a write before the content AND outbox commit.
    res.status(result.status).json(result.payload)
  } catch (error) { next(error) }
}
