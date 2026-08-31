import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import Post from '../src/models/Post.js'
import { getPosts, getPostBySlug } from '../src/controllers/postController.js'

const originalFind = Post.find
const originalCountDocuments = Post.countDocuments
const originalFindOne = Post.findOne

afterEach(() => {
  Post.find = originalFind
  Post.countDocuments = originalCountDocuments
  Post.findOne = originalFindOne
})

const response = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this },
})

test('public posts API filters drafts and omits list content', async () => {
  let filter
  Post.find = (value) => {
    filter = value
    return { select: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [{ title: 'Published', published: true }] }) }) }) }) }
  }
  Post.countDocuments = async () => 1
  const res = response()
  await getPosts({ query: {} }, res, assert.fail)
  assert.equal(filter.published, true)
  assert.equal(res.body.data[0].published, true)
})

test('public post detail does not expose drafts', async () => {
  let filter
  Post.findOne = (value) => {
    filter = value
    return { lean: async () => null }
  }
  const res = response()
  await getPostBySlug({ params: { slug: 'draft-post' } }, res, assert.fail)
  assert.deepEqual(filter, { slug: 'draft-post', published: true })
  assert.equal(res.statusCode, 404)
})
