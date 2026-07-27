import { parsePostContent } from '@/lib/media-embeds'
import InlineVideoEmbed from './InlineVideoEmbed'

// Renders a post body: whitespace preserved, plain URLs auto-linked,
// standalone video URLs replaced with a click-to-play inline embed.
// Server component — safe to use anywhere the raw text used to render.

export default function PostContent({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  const runs = parsePostContent(content)

  return (
    <div
      className={
        className ??
        'mt-2 whitespace-pre-wrap break-words text-stone-800'
      }
    >
      {runs.map((run, i) => {
        if (run.kind === 'text') {
          return <span key={i}>{run.value}</span>
        }
        if (run.kind === 'link') {
          return (
            <a
              key={i}
              href={run.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="underline underline-offset-2 hover:text-stone-900 break-all"
            >
              {run.url}
            </a>
          )
        }
        return <InlineVideoEmbed key={i} info={run.info} />
      })}
    </div>
  )
}
