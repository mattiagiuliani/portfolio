import assert from 'node:assert/strict'
import test from 'node:test'
import { parseInlineMarkdown, resolveInlineMarkdown } from '../src/services/media/inlineMarkdown.js'
import { createInlineImageMarkdown, findInlineMediaMarkers, removeInlineMediaMarkers } from '../../frontend/portfolio/src/lib/inlineMedia.js'

const firstId = '507f1f77bcf86cd799439011'
const secondId = '507f1f77bcf86cd799439012'

test('parses actual managed image nodes and deduplicates IDs for callers', () => {
  const parsed = parseInlineMarkdown(`Before ![diagram](media:${firstId}) and ![](media:${firstId})\n\n![second](media:${secondId}) after`)
  assert.deepEqual(parsed.references.map(({ id }) => id), [firstId, firstId, secondId])
  assert.equal(new Set(parsed.references.map(({ id }) => id)).size, 2)
  assert.deepEqual(parsed.references.map(({ node }) => node.alt), ['diagram', '', 'second'])
})

test('ignores token-like text in fenced code, inline code, and escaped image examples', () => {
  const parsed = parseInlineMarkdown([
    '```md',
    `![fenced](media:${firstId})`,
    '```',
    '',
    'Inline `![code](media:' + firstId + ')` example.',
    '',
    `\\![escaped](media:${firstId})`,
  ].join('\n'))
  assert.deepEqual(parsed.references, [])
})

test('records malformed media destinations only when they are image nodes', () => {
  const parsed = parseInlineMarkdown('![bad](media:not-an-id)\n\n`![code](media:no)`')
  assert.equal(parsed.references.length, 1)
  assert.equal(parsed.references[0].id, null)
})

test('resolves only managed nodes and preserves surrounding Markdown and legacy destinations', () => {
  const source = `# Heading\n\nLegacy ![remote](https://example.test/a.png)\n\nManaged ![diagram](media:${firstId}) and ![local](../image.png).\n`
  const parsed = parseInlineMarkdown(source)
  const result = resolveInlineMarkdown(parsed, new Map([[firstId, { url: 'https://images.example.test/a.png' }]]))
  assert.equal(result, `# Heading\n\nLegacy ![remote](https://example.test/a.png)\n\nManaged ![diagram](https://images.example.test/a.png) and ![local](../image.png).\n`)
})

test('uses escaped accessible text for missing assets and safely serializes alt text', () => {
  const source = `![A *diagram* [v2]](media:${firstId})\n\n![](media:${secondId})`
  const parsed = parseInlineMarkdown(source)
  const result = resolveInlineMarkdown(parsed, new Map())
  assert.equal(result, 'A diagram \\[v2]\n\nImage unavailable')
})

test('detects only the reserved temporary upload comment', () => {
  assert.equal(parseInlineMarkdown('<!--portfolio-media-upload:550e8400-e29b-41d4-a716-446655440000-->').hasPendingMarker, true)
  assert.equal(parseInlineMarkdown('<!--portfolio-media-upload:550e8400-e29b-41d4-a716-446655440000--> trailing text').hasPendingMarker, true)
  assert.equal(parseInlineMarkdown('leading text <!--portfolio-media-upload:550e8400-e29b-41d4-a716-446655440000--> trailing text').hasPendingMarker, true)
  assert.equal(parseInlineMarkdown('```html\n<!--portfolio-media-upload:550e8400-e29b-41d4-a716-446655440000-->\n```').hasPendingMarker, false)
})

test('editor token generation escapes Markdown alt syntax and preserves intentional empty alt', () => {
  const token = createInlineImageMarkdown('A [map] *with* `symbols`', firstId)
  const parsed = parseInlineMarkdown(token)
  assert.equal(parsed.references.length, 1)
  assert.equal(parsed.references[0].node.alt, 'A [map] *with* `symbols`')
  assert.equal(createInlineImageMarkdown('', secondId), `![](media:${secondId})`)
  assert.throws(() => createInlineImageMarkdown('invalid', 'media:bad'), /Invalid media asset ID/)
})

test('discovers managed reference-style images without changing ordinary references or links', () => {
  const source = [
    '![managed][hero]',
    '[ordinary][hero-image]',
    '[shared link][hero]',
    '',
    '[hero]: media:' + firstId,
    '[hero-image]: https://example.test/ordinary.png',
  ].join('\n')
  const parsed = parseInlineMarkdown(source)
  assert.deepEqual(parsed.references.map(({ id, node }) => [id, node.type]), [[firstId, 'imageReference']])
  assert.equal(resolveInlineMarkdown(parsed, new Map([[firstId, { url: 'https://images.example.test/ready.png' }]])), [
    '![managed](https://images.example.test/ready.png)',
    '[ordinary][hero-image]',
    '[shared link][hero]',
    '',
    '[hero]: media:' + firstId,
    '[hero-image]: https://example.test/ordinary.png',
  ].join('\n'))
})

test('validates missing, pending, failed, malformed, and mixed-case managed references', () => {
  const source = [
    '![missing][missing]',
    '![pending][pending]',
    '![failed][failed]',
    '![malformed][malformed]',
    '![mixed][mixed]',
    '',
    '[missing]: media:' + firstId,
    '[pending]: media:' + secondId,
    '[failed]: media:' + firstId,
    '[malformed]: media:not-an-id',
    '[mixed]: MEDIA:' + firstId,
  ].join('\n')
  const parsed = parseInlineMarkdown(source)
  assert.equal(parsed.references.length, 5)
  assert.deepEqual(resolveInlineMarkdown(parsed, new Map()), [
    'missing',
    'pending',
    'failed',
    'malformed',
    'mixed',
    '',
    '[missing]: media:' + firstId,
    '[pending]: media:' + secondId,
    '[failed]: media:' + firstId,
    '[malformed]: media:not-an-id',
    '[mixed]: MEDIA:' + firstId,
  ].join('\n'))
})

test('keeps managed images safe inside GFM tables, including escaped pipes and fallback text', () => {
  const source = [
    '| image | other |',
    '| --- | --- |',
    `| ![ready \\| image](media:${firstId}) | ![missing \\| image](media:${secondId}) |`,
  ].join('\n')
  const parsed = parseInlineMarkdown(source)
  const result = resolveInlineMarkdown(parsed, new Map([[firstId, { url: 'https://images.example.test/ready.png' }]]))
  assert.equal(result, [
    '| image | other |',
    '| --- | --- |',
    '| ![ready \\| image](https://images.example.test/ready.png) | missing \\| image |',
  ].join('\n'))
  const reparsed = parseInlineMarkdown(result)
  assert.equal(reparsed.tree.children[0].type, 'table')
  assert.equal(reparsed.tree.children[0].children[1].children[0].children[0].type, 'image')
})

test('preserves authored named entities in ready managed image replacements', () => {
  const source = `![&copy; &amp;](media:${firstId})`
  const result = resolveInlineMarkdown(parseInlineMarkdown(source), new Map([[firstId, { url: 'https://images.example.test/ready.png' }]]))
  assert.equal(result, '![&copy; &amp;](https://images.example.test/ready.png)')
})

test('uses the first normalized definition for image and link references', () => {
  const managedFirst = `![managed][ref]\n\n[ref]: media:${firstId}\n[REF]: https://legacy.example.test/late.png`
  const legacyFirst = '![legacy][ref]\n\n[ref]: https://legacy.example.test/first.png\n[REF]: media:' + firstId
  assert.deepEqual(parseInlineMarkdown(managedFirst).references.map(({ id }) => id), [firstId])
  assert.deepEqual(parseInlineMarkdown(legacyFirst).references, [])
  assert.equal(resolveInlineMarkdown(parseInlineMarkdown(managedFirst), new Map([[firstId, { url: 'https://images.example.test/ready.png' }]])).split('\n\n')[0], '![managed](https://images.example.test/ready.png)')
  assert.equal(resolveInlineMarkdown(parseInlineMarkdown(legacyFirst), new Map()), legacyFirst)
})

test('reconstructs reference images in tables and preserves titles', () => {
  const source = [
    '| image | keep |',
    '| --- | --- |',
    `| ![ready \\| image][ref] | keep |`,
    '',
    `[ref]: media:${firstId} "media:${firstId}"`,
  ].join('\n')
  const result = resolveInlineMarkdown(parseInlineMarkdown(source), new Map([[firstId, { url: 'https://images.example.test/ready.png' }]]))
  assert.match(result, /!\[ready \\| image\]\(https:\/\/images\.example\.test\/ready\.png "media:507f1f77bcf86cd799439011"\)/)
  const table = parseInlineMarkdown(result).tree.children[0]
  assert.equal(table.type, 'table')
  assert.equal(table.children[1].children[0].children[0].type, 'image')
  assert.equal(table.children[1].children[1].children[0].value, 'keep')
})

test('keeps missing reference-image fallbacks in their table cell and handles multiple contexts', () => {
  const source = [
    `![missing \\| image][missing]`,
    '',
    '| image | keep |',
    '| --- | --- |',
    `| ![missing \\| image][missing] | keep |`,
    '',
    `[missing]: media:${secondId}`,
  ].join('\n')
  const result = resolveInlineMarkdown(parseInlineMarkdown(source), new Map())
  assert.equal(result.split('\n')[0], 'missing | image')
  const table = parseInlineMarkdown(result).tree.children[1]
  assert.equal(table.type, 'table')
  assert.equal(table.children[1].children[0].children[0].value, 'missing | image')
  assert.equal(table.children[1].children[1].children[0].value, 'keep')
})

test('replaces only the parsed inline destination when alt and title contain the managed token', () => {
  const source = `![media:${firstId}](<media:${firstId}> "media:${firstId}")`
  const result = resolveInlineMarkdown(parseInlineMarkdown(source), new Map([[firstId, { url: 'https://images.example.test/ready.png' }]]))
  assert.equal(result, `![media:${firstId}](https://images.example.test/ready.png "media:${firstId}")`)
})

test('formatter preserves literal entity-like alt input through Markdown parsing', () => {
  const token = createInlineImageMarkdown('&copy; &amp; &lt; &#169; &', firstId)
  assert.equal(token, `![&amp;copy; &amp;amp; &amp;lt; &amp;#169; &amp;](media:${firstId})`)
  assert.equal(parseInlineMarkdown(token).references[0].node.alt, '&copy; &amp; &lt; &#169; &')
})

test('temporary marker detection ignores fenced and inline code examples during recovery', () => {
  const marker = '<!--portfolio-media-upload:550e8400-e29b-41d4-a716-446655440000-->'
  const content = `${marker}\n\n\`\`\`md\n${marker}\n\`\`\`\n\n\` ${marker} \`\n\nAfter`
  assert.deepEqual(findInlineMediaMarkers(content).map(({ marker: value }) => value), [marker])
  assert.equal(removeInlineMediaMarkers(content), '\n\n```md\n' + marker + '\n```\n\n` ' + marker + ' `\n\nAfter')
})

test('classifies marker occurrences with Markdown fence and code semantics', () => {
  const marker = '<!--portfolio-media-upload:550e8400-e29b-41d4-a716-446655440000-->'
  const cases = [
    [`Unfinished \`example ${marker}`, 1],
    [`\`\`\`md\n${marker}\n\`\`\``, 0],
    [`> \`\`\`\n> ${marker}\n> \`\`\``, 0],
    [`    ${marker}`, 0],
    [`\` ${marker} \``, 0],
    [`\\\` ${marker}`, 1],
    [`> - item\n>     ${marker}`, 0],
    [`${marker}\n\n\`\`\`md\n${marker}\n\`\`\`\n\n\` ${marker} \``, 1],
    [`- \`\`\`\n  ${marker}\n  \`\`\``, 0],
    [`* \`\`\`\n  ${marker}\n  \`\`\``, 0],
    [`+ \`\`\`\n  ${marker}\n  \`\`\``, 0],
    [`1. \`\`\`\n   ${marker}\n   \`\`\``, 0],
    [`- * \`\`\`\n    ${marker}\n    \`\`\``, 0],
    [`> - \`\`\`\n>   ${marker}\n>   \`\`\``, 0],
    [`Example \` ${marker} \`\``, 1],
    [`Example \`\` ${marker} \``, 1],
    [`Example \`\` ${marker} \`\`\``, 1],
    [`- \`\`\`\n  ${marker}\n  \`\`\`\n${marker}`, 1],
    [`Example \` ${marker} \``, 0],
    [`Example \`\` ${marker} \`\``, 0],
    [`Example \`\`\` ${marker} \`\`\``, 0],
  ]
  for (const [content, count] of cases) assert.equal(findInlineMediaMarkers(content).length, count, content)
})

test('classified occurrence offsets protect code examples during replacement and recovery', () => {
  const marker = '<!--portfolio-media-upload:550e8400-e29b-41d4-a716-446655440000-->'
  const content = `\` ${marker} \`\narticle ${marker}`
  const occurrence = findInlineMediaMarkers(content)[0]
  assert.equal(occurrence.start, content.lastIndexOf(marker))
  const replaced = content.slice(0, occurrence.start) + '![image](media:' + firstId + ')' + content.slice(occurrence.end)
  assert.equal(replaced, `\` ${marker} \`\narticle ![image](media:${firstId})`)
  assert.equal(removeInlineMediaMarkers(content), `\` ${marker} \`\narticle `)
})

test('preserves reference title semantics in paragraphs and GFM tables', () => {
  const titles = [
    'A | B',
    'trailing \\',
    '"quotes"',
    "'quotes'",
    `media:${firstId}`,
    '&copy;',
    'A | trailing \\ "quotes" &copy;',
  ]
  for (const title of titles) {
    const titleSource = title.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
    for (const source of [
      `![image][ref]\n\n[ref]: media:${firstId} "${titleSource}"`,
      `| image | keep |\n| --- | --- |\n| ![image][ref] | keep |\n\n[ref]: media:${firstId} "${titleSource}"`,
    ]) {
      const original = parseInlineMarkdown(source)
      const expectedTitle = original.tree.children.at(-1)?.title ?? title
      const result = resolveInlineMarkdown(original, new Map([[firstId, { url: 'https://images.example.test/ready.png' }]]))
      const reparsed = parseInlineMarkdown(result)
      const image = source.startsWith('|')
        ? reparsed.tree.children[0].children[1].children[0].children[0]
        : reparsed.tree.children[0].children[0]
      assert.equal(image.type, 'image')
      assert.equal(image.url, 'https://images.example.test/ready.png')
      assert.equal(image.title, expectedTitle)
      if (source.startsWith('|')) assert.equal(reparsed.tree.children[0].children[1].children[1].children[0].value, 'keep')
    }
  }
})

for (const [name, prefix, indent] of [
  ['dash', '- ', '  '],
  ['star', '* ', '  '],
  ['plus', '+ ', '  '],
  ['ordered', '1. ', '   '],
  ['nested', '- * ', '    '],
  ['nested ordered', '1. 2. ', '      '],
  ['blockquote list', '> - ', '>   '],
]) {
  test(`list fence ${name} closes before a real marker and recovery preserves code`, () => {
    const marker = '<!--portfolio-media-upload:550e8400-e29b-41d4-a716-446655440000-->'
    const example = `${prefix}\`\`\`html\n${indent}${marker}\n${indent}\`\`\``
    assert.equal(parseInlineMarkdown(example).hasPendingMarker, false)
    assert.deepEqual(findInlineMediaMarkers(example), [])
    const source = `${example}\n\n${marker}`
    assert.equal(parseInlineMarkdown(source).hasPendingMarker, true)
    assert.deepEqual(findInlineMediaMarkers(source), [{ marker, start: source.lastIndexOf(marker), end: source.length }])
    const recovered = removeInlineMediaMarkers(source)
    assert.equal(recovered, `${example}\n\n`)
    assert.equal(parseInlineMarkdown(recovered).hasPendingMarker, false)
    assert.deepEqual(findInlineMediaMarkers(recovered), [])
  })
}

test('list padding preserves indented code while ordinary list markers stay real', () => {
  const marker = '<!--portfolio-media-upload:550e8400-e29b-41d4-a716-446655440000-->'
  for (const prefix of ['-', '*', '+', '1.', '12)', '- *']) {
    for (const spaces of [1, 2, 3, 4, 5, 6]) {
      const source = `${prefix}${' '.repeat(spaces)}${marker}`
      const real = spaces <= 4
      assert.equal(parseInlineMarkdown(source).hasPendingMarker, real, source)
      assert.equal(findInlineMediaMarkers(source).length, Number(real), source)
      assert.equal(removeInlineMediaMarkers(source), real ? source.replace(marker, '') : source)
    }
  }
})

test('exact backtick delimiter matrix agrees with the backend Markdown parser', () => {
  const marker = '<!--portfolio-media-upload:550e8400-e29b-41d4-a716-446655440000-->'
  for (const [open, close, real] of [[1, 1, false], [1, 2, true], [2, 1, true], [2, 2, false], [2, 3, true], [3, 3, false]]) {
    const source = `Example ${'`'.repeat(open)}${marker}${'`'.repeat(close)}`
    assert.equal(parseInlineMarkdown(source).hasPendingMarker, real, source)
    assert.equal(findInlineMediaMarkers(source).length, Number(real), source)
  }
})
