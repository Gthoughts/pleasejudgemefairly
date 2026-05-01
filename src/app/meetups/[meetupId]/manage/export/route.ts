import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /meetups/[meetupId]/manage/export
// Returns a CSV of attendees with their registration answers.
// Only accessible to the organiser.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ meetupId: string }> }
) {
  const { meetupId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect('/signin')
  }

  // Verify organiser.
  const { data: meetup } = await supabase
    .from('meetups')
    .select('organiser_id, title, meetup_questions(id, question_text, display_order)')
    .eq('id', meetupId)
    .maybeSingle<{
      organiser_id: string
      title: string
      meetup_questions: { id: string; question_text: string; display_order: number }[]
    }>()

  if (!meetup || meetup.organiser_id !== user.id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const questions = (meetup.meetup_questions ?? []).sort(
    (a, b) => a.display_order - b.display_order
  )

  // Fetch registrations with answers.
  const { data: regs } = await supabase
    .from('meetup_registrations')
    .select(
      'id, user_id, is_waitlist, created_at, users:user_id(username), meetup_answers(question_id, answer_text)'
    )
    .eq('meetup_id', meetupId)
    .order('created_at', { ascending: true })
    .returns<{
      id: string
      user_id: string
      is_waitlist: boolean
      created_at: string
      users: { username: string } | null
      meetup_answers: { question_id: string; answer_text: string }[]
    }[]>()

  const rows = regs ?? []

  // Build CSV.
  function esc(v: string): string {
    // RFC 4180: quote fields containing commas, quotes, or newlines.
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`
    }
    return v
  }

  const headers = [
    'Username',
    'Registration date',
    'Waitlist',
    ...questions.map((q) => q.question_text),
  ]

  const lines: string[] = [headers.map(esc).join(',')]

  for (const reg of rows) {
    const answerMap = new Map(
      (reg.meetup_answers ?? []).map((a) => [a.question_id, a.answer_text])
    )
    const row = [
      reg.users?.username ?? '',
      new Date(reg.created_at).toLocaleString('en-GB'),
      reg.is_waitlist ? 'yes' : 'no',
      ...questions.map((q) => answerMap.get(q.id) ?? ''),
    ]
    lines.push(row.map(esc).join(','))
  }

  const csv = lines.join('\r\n')
  const filename = `attendees-${meetupId.slice(0, 8)}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
