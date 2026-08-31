import assert from 'node:assert/strict'
import test from 'node:test'
import Settings from '../src/models/Settings.js'

test('Settings schema enforces a sparse unique singleton key without exposing it', () => {
  const indexes = Settings.schema.indexes()
  assert.ok(indexes.some(([fields, options]) => fields.singletonKey === 1 && options.unique && options.sparse))
  assert.equal(Settings.schema.path('singletonKey').options.select, false)
})
