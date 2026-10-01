import { remark } from 'remark'
import remarkGfm from 'remark-gfm'

const processor = remark().use(remarkGfm)
const managedDestination = /^media:(.*)$/i
const canonicalManagedDestination = /^media:(.*)$/
const validMediaId = /^[a-f\d]{24}$/i
const pendingMarker = /<!--portfolio-media-upload:[a-f\d-]+-->/i

function walk(node, visit, ancestors = []) {
  visit(node, ancestors)
  for (const child of node.children ?? []) walk(child, visit, [...ancestors, node])
}

export function parseInlineMarkdown(content) {
  const tree = processor.parse(content)
  const references = []
  let hasPendingMarker = false
  const definitions = new Map()

  walk(tree, (node) => {
    if (node.type === 'definition' && !definitions.has(node.identifier)) definitions.set(node.identifier, node)
  })

  walk(tree, (node, ancestors) => {
    if (node.type === 'image') {
      const match = managedDestination.exec(node.url)
      if (match) {
        references.push({
          id: canonicalManagedDestination.test(node.url) && validMediaId.test(match[1]) ? match[1] : null,
          destination: node.url,
          node,
          inTable: ancestors.some((ancestor) => ancestor.type === 'tableCell'),
        })
      }
    } else if (node.type === 'imageReference') {
      const definition = definitions.get(node.identifier)
      const destination = definition?.url
      const match = typeof destination === 'string' ? managedDestination.exec(destination) : null
      if (match) {
        references.push({
          id: canonicalManagedDestination.test(destination) && validMediaId.test(match[1]) ? match[1] : null,
          destination,
          node,
          definition,
          inTable: ancestors.some((ancestor) => ancestor.type === 'tableCell'),
        })
      }
    } else if (node.type === 'html' && pendingMarker.test(node.value)) {
      hasPendingMarker = true
    }
  })

  return { content, tree, references, hasPendingMarker }
}

export function uniqueInlineMediaIds(parsed) {
  return [...new Set(parsed.references.filter(({ id }) => id).map(({ id }) => id.toLowerCase()))]
}

function escapeFallback(value, inTable) {
  const escaped = processor.stringify({
    type: 'root',
    children: [{ type: 'text', value: value || 'Image unavailable' }],
  }).trimEnd()
  return inTable ? escaped.replaceAll('|', '\\|') : escaped
}

function findClosingBracket(source, start) {
  let depth = 0
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '\\') {
      index += 1
    } else if (source[index] === '[') {
      depth += 1
    } else if (source[index] === ']') {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

function findInlineDestination(source) {
  const labelEnd = findClosingBracket(source, 1)
  if (labelEnd < 0 || source[labelEnd + 1] !== '(') return null
  let index = labelEnd + 2
  while (/\s/.test(source[index] ?? '')) index += 1
  const start = index
  if (source[index] === '<') {
    index += 1
    while (index < source.length && source[index] !== '>') {
      if (source[index] === '\\') index += 1
      index += 1
    }
    return index < source.length ? { start, end: index + 1 } : null
  }
  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2
    } else if (/\s/.test(source[index]) || source[index] === ')') {
      break
    } else {
      index += 1
    }
  }
  return { start, end: index }
}

function escapeReferenceTitle(title, inTable) {
  const delimiter = title.includes('"') && !title.includes("'") ? "'" : '"'
  const escaped = [...title].map((character) => {
    if (character === '&') return '&amp;'
    if (character === '\\') return '\\\\'
    if (character === delimiter) return `\\${character}`
    if (inTable && character === '|') return '\\|'
    return character
  }).join('')
  return `${delimiter}${escaped}${delimiter}`
}

function referenceImageMarkdown(node, source, destination, definition, inTable) {
  const labelEnd = findClosingBracket(source, 1)
  const label = labelEnd >= 0 ? source.slice(0, labelEnd + 1) : `![${node.alt}]`
  const title = definition?.title
  const titleText = title === null || title === undefined ? '' : ` ${escapeReferenceTitle(title, inTable)}`
  return `${label}(${destination}${titleText})`
}

function markdownForNode(node, destination, source, inTable, definition) {
  if (destination === null) {
    return escapeFallback(node.alt, inTable)
  }

  if (node.type === 'image') {
    const location = findInlineDestination(source)
    if (location) return source.slice(0, location.start) + destination + source.slice(location.end)
  } else if (node.type === 'imageReference') {
    return referenceImageMarkdown(node, source, destination, definition, inTable)
  }

  return processor.stringify({
    type: 'root',
    children: [{ type: 'image', alt: node.alt, url: destination }],
  }).trimEnd()
}

function replaceReferences(parsed, destinationFor) {
  const replacements = parsed.references
    .filter(({ node }) => Number.isInteger(node.position?.start.offset) && Number.isInteger(node.position?.end.offset))
    .map(({ id, node, inTable, definition }) => ({
      start: node.position.start.offset,
      end: node.position.end.offset,
      value: markdownForNode(node, destinationFor(id, node), parsed.content.slice(node.position.start.offset, node.position.end.offset), inTable, definition),
    }))
    .sort((left, right) => right.start - left.start)

  let result = parsed.content
  for (const replacement of replacements) {
    result = result.slice(0, replacement.start) + replacement.value + result.slice(replacement.end)
  }
  return result
}

export function resolveInlineMarkdown(parsed, assetsById) {
  return replaceReferences(parsed, (id) => {
    if (!id) return null
    const asset = assetsById.get(id.toLowerCase()) ?? assetsById.get(id)
    return asset?.url ?? null
  })
}

export function isValidInlineMediaId(value) {
  return typeof value === 'string' && validMediaId.test(value)
}