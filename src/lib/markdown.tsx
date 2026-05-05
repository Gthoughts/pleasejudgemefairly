// Minimal markdown renderer. Deliberately tiny — no third-party deps,
// no scripts in the rendered output, only the limited set of constructs
// the project documents actually use:
//
//   # / ## / ### headings
//   paragraphs (separated by blank lines)
//   - bullet lists
//   1. numbered lists
//   > blockquote
//   ---  horizontal rule
//   **bold**, *italic*, `code`, [text](url)
//
// Anything else is rendered as plain text. Untrusted markdown is escaped
// before pattern substitution so HTML in the source is shown verbatim.

import { Fragment, ReactNode } from 'react'

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Renders inline markdown (bold/italic/code/link) inside a single line.
function renderInline(line: string, keyPrefix: string): ReactNode[] {
  // Tokenise greedily by character. Use a simple regex-based pass.
  const tokens: ReactNode[] = []
  let i = 0
  let buf = ''
  let n = 0
  const flush = () => {
    if (buf.length > 0) {
      tokens.push(<Fragment key={`${keyPrefix}-t-${n++}`}>{buf}</Fragment>)
      buf = ''
    }
  }
  while (i < line.length) {
    const rest = line.slice(i)

    // [text](url)
    const linkMatch = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      flush()
      tokens.push(
        <a
          key={`${keyPrefix}-l-${n++}`}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-stone-900"
        >
          {linkMatch[1]}
        </a>
      )
      i += linkMatch[0].length
      continue
    }

    // **bold**
    if (rest.startsWith('**')) {
      const end = rest.indexOf('**', 2)
      if (end > 2) {
        flush()
        tokens.push(
          <strong key={`${keyPrefix}-b-${n++}`}>{rest.slice(2, end)}</strong>
        )
        i += end + 2
        continue
      }
    }

    // *italic* (single asterisk, not part of **)
    if (rest.startsWith('*') && !rest.startsWith('**')) {
      const end = rest.indexOf('*', 1)
      if (end > 1) {
        flush()
        tokens.push(<em key={`${keyPrefix}-i-${n++}`}>{rest.slice(1, end)}</em>)
        i += end + 1
        continue
      }
    }

    // `code`
    if (rest.startsWith('`')) {
      const end = rest.indexOf('`', 1)
      if (end > 1) {
        flush()
        tokens.push(
          <code
            key={`${keyPrefix}-c-${n++}`}
            className="rounded bg-stone-100 px-1 py-0.5 text-sm font-mono"
          >
            {rest.slice(1, end)}
          </code>
        )
        i += end + 1
        continue
      }
    }

    buf += line[i]
    i++
  }
  flush()
  return tokens
}

// Renders a markdown document to React. Splits into block-level elements.
export function Markdown({ source }: { source: string }) {
  // Normalise line endings then split into lines.
  const lines = (source ?? '').replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let blockIdx = 0

  function key(): string {
    return `b-${blockIdx++}`
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Skip blank lines between blocks.
    if (trimmed === '') {
      i++
      continue
    }

    // Horizontal rule.
    if (/^---+$/.test(trimmed)) {
      blocks.push(<hr key={key()} className="my-6 border-stone-200" />)
      i++
      continue
    }

    // Heading.
    const h = /^(#{1,3})\s+(.*)$/.exec(trimmed)
    if (h) {
      const level = h[1].length
      const text = h[2]
      const inline = renderInline(escape(text), key())
      if (level === 1)
        blocks.push(
          <h1 key={key()} className="mt-6 mb-3 text-2xl font-semibold text-stone-900">
            {inline}
          </h1>
        )
      else if (level === 2)
        blocks.push(
          <h2 key={key()} className="mt-6 mb-2 text-xl font-semibold text-stone-900">
            {inline}
          </h2>
        )
      else
        blocks.push(
          <h3 key={key()} className="mt-5 mb-2 text-lg font-medium text-stone-900">
            {inline}
          </h3>
        )
      i++
      continue
    }

    // Blockquote.
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''))
        i++
      }
      blocks.push(
        <blockquote
          key={key()}
          className="my-3 border-l-2 border-stone-300 pl-4 text-stone-600 italic"
        >
          {quoteLines.map((q, idx) => (
            <p key={idx}>{renderInline(escape(q), `${key()}-q-${idx}`)}</p>
          ))}
        </blockquote>
      )
      continue
    }

    // Unordered list.
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ''))
        i++
      }
      const k = key()
      blocks.push(
        <ul key={k} className="my-3 ml-5 list-disc space-y-1 text-stone-700">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(escape(it), `${k}-li-${idx}`)}</li>
          ))}
        </ul>
      )
      continue
    }

    // Ordered list.
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''))
        i++
      }
      const k = key()
      blocks.push(
        <ol key={k} className="my-3 ml-5 list-decimal space-y-1 text-stone-700">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(escape(it), `${k}-li-${idx}`)}</li>
          ))}
        </ol>
      )
      continue
    }

    // Paragraph: collect consecutive non-blank lines that don't open a new block.
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,3})\s+/.test(lines[i].trim()) &&
      !/^[-*+]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith('>') &&
      !/^---+$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i])
      i++
    }
    const k = key()
    blocks.push(
      <p key={k} className="my-3 text-stone-700 leading-relaxed">
        {renderInline(escape(paraLines.join(' ')), k)}
      </p>
    )
  }

  return <>{blocks}</>
}
