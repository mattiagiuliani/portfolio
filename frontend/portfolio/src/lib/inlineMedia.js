const markerPattern = /<!--portfolio-media-upload:[a-f\d-]+-->/gi

export function createInlineImageMarkdown(alt, mediaId) {
  if (!/^[a-f\d]{24}$/i.test(mediaId)) throw new Error('Invalid media asset ID')
  const punctuation = '\\`*_{}[]()#+-.!>~|<'
  const escapedAlt = [...alt].map((character, index) => {
    if (character === '&') return '&amp;'
    if (character === '#' && alt[index - 1] === '&') return character
    return punctuation.includes(character) ? `\\${character}` : character
  }).join('')
  return `![${escapedAlt}](media:${mediaId})`
}

function fenceForLine(line) {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})/)
  return match ? { character: match[1][0], length: match[1].length } : null
}

function containerLine(line) {
  let index = 0
  let quoteDepth = 0
  while (index < line.length) {
    const quote = line.slice(index).match(/^ {0,3}>[ \t]?/)
    if (!quote) break
    index += quote[0].length
    quoteDepth += 1
  }
  const quoteEnd = index
  while (true) {
    const list = line.slice(index).match(/^( {0,3}(?:[*+-]|\d+[.)]))([ \t]+)/)
    if (!list) break
    // Markdown uses one padding space when five or more follow a list marker;
    // the remaining indentation belongs to the item's code block.
    index += list[1].length + (list[2].length > 4 ? 1 : list[2].length)
  }
  return { body: line.slice(index), start: index, quoteDepth, quoteEnd, listIndent: index - quoteEnd }
}

function isEscaped(text, index) {
  let slashes = 0
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) slashes += 1
  return slashes % 2 === 1
}

function isExactBacktickRun(text, start, length) {
  return text[start - 1] !== '`' && text[start + length] !== '`'
}

function visibleSegments(line) {
  const segments = []
  let cursor = 0
  let visibleStart = 0
  while (cursor < line.length) {
    if (line[cursor] !== '`' || isEscaped(line, cursor)) {
      cursor += 1
      continue
    }
    let runLength = 1
    while (line[cursor + runLength] === '`') runLength += 1
    const run = '`'.repeat(runLength)
    let closing = cursor + runLength
    while (closing < line.length) {
      const candidate = line.indexOf(run, closing)
      if (candidate < 0) break
      if (!isEscaped(line, candidate) && isExactBacktickRun(line, candidate, runLength)) {
        closing = candidate
        break
      }
      closing = candidate + 1
    }
    if (closing >= line.length || line.slice(closing, closing + runLength) !== run) {
      cursor += runLength
      continue
    }
    if (visibleStart < cursor) segments.push({ text: line.slice(visibleStart, cursor), start: visibleStart })
    cursor = closing + runLength
    visibleStart = cursor
  }
  if (visibleStart < line.length) segments.push({ text: line.slice(visibleStart), start: visibleStart })
  return segments
}

export function findInlineMediaMarkers(content) {
  const markers = []
  let offset = 0
  const fences = new Map()
  for (const line of content.split(/\r?\n/)) {
    const container = containerLine(line)
    let fence = fences.get(container.quoteDepth)
    let fenceBody = container.body
    if (fence?.listIndent) {
      const continuation = line.slice(container.quoteEnd)
      if (continuation.startsWith(' '.repeat(fence.listIndent))) {
        fenceBody = continuation.slice(fence.listIndent)
      } else if (continuation.trim()) {
        // An outdent ends the list container, including an unclosed fence.
        fences.delete(container.quoteDepth)
        fence = null
      }
    }
    const lineFence = fenceForLine(fenceBody)
    if (fence) {
      if (lineFence?.character === fence.character && lineFence.length >= fence.length) fences.delete(container.quoteDepth)
      offset += line.length + (content[offset + line.length] === '\r' ? 2 : 1)
      continue
    }
    if (lineFence) {
      fences.set(container.quoteDepth, { ...lineFence, listIndent: container.listIndent })
      offset += line.length + (content[offset + line.length] === '\r' ? 2 : 1)
      continue
    }

    const indentedCode = /^(?: {4,}|\t)/.test(container.body)
      || /^(?:[*+-]|\d+[.)]) {4,}/.test(container.body)
    if (!indentedCode) for (const segment of visibleSegments(container.body)) {
      for (const match of segment.text.matchAll(markerPattern)) {
        const marker = match[0]
        const start = offset + container.start + segment.start + match.index
        markers.push({ marker, start, end: start + marker.length })
      }
    }
    offset += line.length + (content[offset + line.length] === '\r' ? 2 : 1)
  }
  return markers
}

export function findInlineMediaMarker(content, marker) {
  return findInlineMediaMarkers(content).find((occurrence) => occurrence.marker === marker) ?? null
}

export function removeInlineMediaMarkers(content) {
  const markers = findInlineMediaMarkers(content)
  let result = content
  for (const marker of markers.sort((left, right) => right.start - left.start)) {
    result = result.slice(0, marker.start) + result.slice(marker.end)
  }
  return result
}
