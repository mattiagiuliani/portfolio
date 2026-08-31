# Portfolio Backend

Express + MongoDB backend for the contact form.

## Stack

- Node.js (ES Modules)
- Express.js
- MongoDB + Mongoose
- express-validator (input validation)
- CORS (restricted to frontend origin)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Edit `.env` with your values:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/portfolio
FRONTEND_ORIGIN=http://localhost:5173
NODE_ENV=development
```

> **Note:** Add `.env` to `.gitignore` before committing.

### 3. Run in development

```bash
npm run dev
```

### 4. Run in production

```bash
npm start
```

## API

### `POST /api/contact`

Submit a contact form message.

**Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "message": "Hello, I'd love to get in touch!"
}
```

**Success (201):**

```json
{
  "success": true,
  "message": "Message received. I will get back to you soon!",
  "id": "<mongodb_id>"
}
```

**Validation error (422):**

```json
{
  "success": false,
  "errors": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

### `GET /api/health`

Returns `{ "status": "ok" }` — used to verify the server is running.

## Contact Model

| Field       | Type   | Notes                              |
|-------------|--------|------------------------------------|
| `name`      | String | Required, max 100 chars            |
| `email`     | String | Required, validated, lowercased    |
| `message`   | String | Required, 10–2000 chars            |
| `status`    | String | `unread` \| `read` \| `archived`   |
| `createdAt` | Date   | Auto (Mongoose timestamps)         |
| `updatedAt` | Date   | Auto (Mongoose timestamps)         |
