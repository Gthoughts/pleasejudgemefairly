import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AVAILABILITY_LABEL, type Availability } from '@/lib/projects'

// GET /projects/[projectId]/manage/export
// Returns a CSV of all interest registrations for the project, including
// each registrant's tier, availability, location, skills and motivation.
// Only the project creator can read the underlying rows under RLS, so any
// other authenticated user will see an empty file at most.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect('/signin')
  }

  const { data: project } = await supabase
    .from('projects')
    .select('creator_id, title')
    .eq('id', projectId)
    .maybeSingle<{ creator_id: string; title: string }>()

  if (!project || project.creator_id !== user.id) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const { data: tiersData } = await supabase
    .from('project_tiers')
    .select('id, name, total_amount, display_order')
    .eq('project_id', projectId)
    .returns<
      { id: string; name: string; total_amount: number; display_order: number }[]
    >()
  const tierMap = new Map(
    (tiersData ?? []).map((t) => [t.id, t])
  )

  const { data: regs } = await supabase
    .from('project_registrations')
    .select(
      'id, user_id, tier_id, skills_text, location_text, motivation_text, availability, created_at, users:user_id(username)'
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .returns<
      {
        id: string
        user_id: string
        tier_id: string
        skills_text: string
        location_text: string
        motivation_text: string
        availability: Availability
        created_at: string
        users: { username: string } | null
      }[]
    >()

  const rows = regs ?? []

  function esc(v: string): string {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`
    }
    return v
  }

  const headers = [
    'Username',
    'Registration date',
    'Tier',
    'Tier total (£)',
    'Availability',
    'Location',
    'Skills',
    'Motivation',
  ]

  const lines: string[] = [headers.map(esc).join(',')]

  for (const r of rows) {
    const tier = tierMap.get(r.tier_id)
    const row = [
      r.users?.username ?? '',
      new Date(r.created_at).toLocaleString('en-GB'),
      tier?.name ?? '',
      tier ? String(Number(tier.total_amount) || 0) : '',
      AVAILABILITY_LABEL[r.availability] ?? r.availability,
      r.location_text,
      r.skills_text,
      r.motivation_text,
    ]
    lines.push(row.map(esc).join(','))
  }

  const csv = lines.join('\r\n')
  const filename = `project-${projectId.slice(0, 8)}-registrations.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
