import assert from 'node:assert/strict'
import test from 'node:test'
import { isValidBlogCoverImage } from '../src/utils/blogCoverImage.js'

test('blog cover image validation accepts local paths and HTTPS URLs', () => {
  assert.equal(isValidBlogCoverImage('/images/blog/javascript.webp'), true)
  assert.equal(isValidBlogCoverImage('/images/blog/react.jpg'), true)
  assert.equal(isValidBlogCoverImage('/images/blog/my-image.png'), true)
  assert.equal(isValidBlogCoverImage('https://images.example.com/existing-cover.jpg'), true)
})

test('blog cover image validation rejects unsafe or unsupported URLs', () => {
  assert.equal(isValidBlogCoverImage('javascript:alert(1)'), false)
  assert.equal(isValidBlogCoverImage('data:image/png;base64,abc'), false)
  assert.equal(isValidBlogCoverImage('file:///tmp/image.png'), false)
  assert.equal(isValidBlogCoverImage('/images/blog/../private.png'), false)
  assert.equal(isValidBlogCoverImage('/images/blog/image.svg'), false)
})
