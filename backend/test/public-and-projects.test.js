import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import Project from '../src/models/Project.js'
import { getPublicProjects } from '../src/controllers/publicController.js'
import { createProject, updateProject, deleteProject } from '../src/controllers/projectController.js'

const originalFind = Project.find
const originalFindById = Project.findById
const originalFindByIdAndDelete = Project.findByIdAndDelete
const originalSave = Project.prototype.save

afterEach(() => {
  Project.find = originalFind
  Project.findById = originalFindById
  Project.findByIdAndDelete = originalFindByIdAndDelete
  Project.prototype.save = originalSave
})

const response = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this },
})

test('public API requests only published projects', async () => {
  let filter
  Project.find = (value) => {
    filter = value
    return { sort: () => ({ lean: async () => [{ title: 'Published', published: true }] }) }
  }
  const res = response()
  await getPublicProjects({}, res, assert.fail)
  assert.deepEqual(filter, { published: true })
  assert.deepEqual(res.body.data, [{ title: 'Published', published: true }])
})

test('projects CRUD creates, updates and deletes through controller responses', async () => {
  Project.prototype.save = async function () { return this }
  const created = response()
  await createProject({ body: { title: 'New project', description: 'A valid description' } }, created, assert.fail)
  assert.equal(created.statusCode, 201)
  assert.equal(created.body.data.title, 'New project')

  const existing = { set(data) { Object.assign(this, data) }, save: async () => {} }
  Project.findById = async () => existing
  const updated = response()
  await updateProject({ params: { id: '507f1f77bcf86cd799439011' }, body: { title: 'Updated' } }, updated, assert.fail)
  assert.equal(updated.body.data.title, 'Updated')

  Project.findByIdAndDelete = async () => existing
  const deleted = response()
  await deleteProject({ params: { id: '507f1f77bcf86cd799439011' } }, deleted, assert.fail)
  assert.equal(deleted.body.success, true)
})
