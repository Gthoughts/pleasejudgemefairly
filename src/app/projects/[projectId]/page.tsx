import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import ProjectsHeader from '@/components/ProjectsHeader'
import SiteFooter from '@/components/SiteFooter'
import { createClient } from '@/lib/supabase/server'
import { getAdminUserIds, getDisplayUsername } from '@/lib/admin'
import { Markdown } from '@/lib/markdown'
import { MAX_REPLY_DEPTH } from '@/lib/discuss'
import { formatGBP, type Availability } from '@/lib/projects'
import ProjectPostItem from './ProjectPostItem'
import ProjectRootReplyForm from './ProjectRootReplyForm'
import RegisterInterestSection from './RegisterInterestSection'

type TierRow = {
  id: string
  name: string
  upfront_amount: number
  monthly_amount: number
  monthly_duration_months: number
  total_amount: number
  target_slots: number
  phase_choice: boolean
  display_order: number
}

type ProjectPostRow = {
  id: string
  project_id: string
  update_id: string | null
  parent_post_id: string | null
  author_id: string
  content: string
  is_pinned: boolean
  is_collapsed: boolean
  hold_state: 'none' | 'held' | 'released'
  hold_reasons: string[] | null
  created_at: string
  updated_at: string
  users: { username: string } | null
}

type PostNode = ProjectPostRow & { depth: number; children: PostNode[] }

function buildTree(posts: ProjectPostRow[]): PostNode[] {
  const byId = new Map<string, PostNode>()
  for (const p of posts) {
    byId.set(p.id, { ...p, depth: 0, children: [] })
  }
  const roots: PostNode[] = []
  for (const node of byId.values()) {
    if (node.parent_post_id && byId.has(node.parent_post_id)) {
      const parent = byId.get(node.parent_post_id)!
      node.depth = parent.depth + 1
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sort = (nodes: PostNode[]) => {
    nodes.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    nodes.forEach((n) => sort(n.children))
  }
  sort(roots)
  roots.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0))
  return roots
}

function renderNode(
  node: PostNode,
  common: {
    projectId: string
    currentUserId: string | null
    mutedIds: Set<string>
    myRatings: Map<string, 'helpful' | 'unhelpful'>
    adminIds: Set<string>
  }
): React.ReactNode {
  return (
    <ProjectPostItem
      key={node.id}
      post={{
        id: node.id,
        content: node.content,
        created_at: node.created_at,
        updated_at: node.updated_at,
        author_id: node.author_id,
        author_username: getDisplayUsername(
          node.author_id,
          node.users?.username ?? 'unknown',
          common.adminIds
        ),
        depth: node.depth,
        isPinned: node.is_pinned,
        isCollapsed: node.is_collapsed,
        holdState: node.hold_state,
        holdReasons: node.hold_reasons,
      }}
      projectId={common.projectId}
      currentUserId={common.currentUserId}
      isMutedByMe={common.mutedIds.has(node.author_id)}
      myRating={common.myRatings.get(node.id) ?? null}
      canReply={!!common.currentUserId && node.depth < MAX_REPLY_DEPTH}
    >
      {node.children.length > 0 && (
        <ul className="mt-4 space-y-4 border-l border-stone-200 pl-4">
          {node.children.map((child) => (
            <li key={child.id}>{renderNode(child, common)}</li>
          ))}
        </ul>
      )}
    </ProjectPostItem>
  )
}

function formatUpdateDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function ProjectPage(
  props: PageProps<'/projects/[projectId]'>
) {
  const { projectId } = await props.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/signin?next=/projects/${projectId}`)

  const adminIds = await getAdminUserIds()

  // Fetch project + tiers.
  const { data: project } = await supabase
    .from('projects')
    .select(
      'id, title, short_description, vision_content, model_content, pdf_url, creator_id, status, funding_target, per_person_target, created_at, updated_at, users:creator_id(username), project_tiers(id, name, upfront_amount, monthly_amount, monthly_duration_months, total_amount, target_slots, phase_choice, display_order)'
    )
    .eq('id', projectId)
    .maybeSingle<{
      id: string
      title: string
      short_description: string
      vision_content: string
      model_content: string
      pdf_url: string | null
      creator_id: string
      status: string
      funding_target: number
      per_person_target: number
      created_at: string
      updated_at: string
      users: { username: string } | null
      project_tiers: TierRow[]
    }>()

  if (!project) notFound()

  const tiers = (project.project_tiers ?? []).sort(
    (a, b) => a.display_order - b.display_order
  )
  const financialTiers = tiers.filter((t) => t.total_amount > 0)

  const isCreator = project.creator_id === user.id
  const isAdmin = adminIds.has(user.id)

  // Aggregate registration counts via SECURITY DEFINER RPCs.
  const { data: totalCountRaw } = await supabase.rpc(
    'project_registration_count',
    { p_project_id: projectId }
  )
  const totalCount =
    typeof totalCountRaw === 'number'
      ? totalCountRaw
      : Number(totalCountRaw ?? 0)

  const { data: breakdownRowsRaw } = await supabase.rpc(
    'project_tier_breakdown',
    { p_project_id: projectId }
  )
  const breakdownRows = (breakdownRowsRaw ?? []) as Array<{
    tier_id: string
    registration_count: number | string
  }>

  const tierCounts = new Map<string, number>()
  for (const row of breakdownRows) {
    tierCounts.set(row.tier_id, Number(row.registration_count) || 0)
  }

  // Current user's own registration (visible to themselves under RLS).
  const { data: myRegRaw } = await supabase
    .from('project_registrations')
    .select(
      'tier_id, skills_text, location_text, motivation_text, availability'
    )
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle<{
      tier_id: string
      skills_text: string
      location_text: string
      motivation_text: string
      availability: Availability
    }>()
  const myRegistration = myRegRaw ?? null

  // Progress updates.
  const { data: updatesData } = await supabase
    .from('project_updates')
    .select('id, title, content, author_id, created_at, users:author_id(username)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .returns<
      {
        id: string
        title: string
        content: string
        author_id: string
        created_at: string
        users: { username: string } | null
      }[]
    >()
  const updates = updatesData ?? []

  // All discussion posts in one fetch; partition by update_id afterwards.
  const { data: postRows } = await supabase
    .from('project_posts')
    .select(
      'id, project_id, update_id, parent_post_id, author_id, content, is_pinned, is_collapsed, hold_state, hold_reasons, created_at, updated_at, users:author_id(username)'
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .returns<ProjectPostRow[]>()

  const allPosts = postRows ?? []
  const mainDiscussionRoots = buildTree(allPosts.filter((p) => p.update_id === null))
  const updatePostsByUpdate = new Map<string, ProjectPostRow[]>()
  for (const p of allPosts) {
    if (!p.update_id) continue
    const existing = updatePostsByUpdate.get(p.update_id) ?? []
    existing.push(p)
    updatePostsByUpdate.set(p.update_id, existing)
  }

  // Mutes + my ratings.
  const mutedIds = new Set<string>()
  const myRatings = new Map<string, 'helpful' | 'unhelpful'>()

  const { data: mutes } = await supabase
    .from('mutes')
    .select('muted_user_id')
    .eq('user_id', user.id)
  for (const m of mutes ?? [])
    mutedIds.add((m as { muted_user_id: string }).muted_user_id)

  const postIds = allPosts.map((p) => p.id)
  if (postIds.length > 0) {
    const { data: ratingRows } = await supabase
      .from('ratings')
      .select('content_id, rating')
      .eq('user_id', user.id)
      .eq('content_type', 'project_post')
      .in('content_id', postIds)
    for (const r of ratingRows ?? []) {
      myRatings.set(
        r.content_id as string,
        r.rating as 'helpful' | 'unhelpful'
      )
    }
  }

  const common = {
    projectId,
    currentUserId: user.id,
    mutedIds,
    myRatings,
    adminIds,
  }

  const creatorUsername = getDisplayUsername(
    project.creator_id,
    project.users?.username ?? 'unknown',
    adminIds
  )

  const isCancelled = project.status !== 'active'

  return (
    <>
      <ProjectsHeader />
      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-2xl space-y-16">
          {/* Header */}
          <section>
            <p className="text-sm text-stone-500">
              <Link href="/projects" className="underline hover:text-stone-900">
                ← Projects
              </Link>
            </p>
            {project.status === 'paused' && (
              <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                This project is currently paused.
              </div>
            )}
            {project.status === 'completed' && (
              <div className="mt-3 rounded border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                This project has been completed.
              </div>
            )}
            <div className="mt-2 flex items-start justify-between gap-4">
              <h1 className="text-2xl font-semibold">{project.title}</h1>
              {(isCreator || isAdmin) && (
                <Link
                  href={`/projects/${projectId}/manage`}
                  className="shrink-0 rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:border-stone-500 hover:text-stone-900"
                >
                  Manage
                </Link>
              )}
            </div>
            <p className="mt-2 text-sm text-stone-600">
              {project.short_description}
            </p>
            <p className="mt-2 text-xs text-stone-500">
              Created by {creatorUsername}
            </p>
          </section>

          {/* Section 1: The Vision */}
          <section>
            <h2 className="text-xl font-semibold">The vision</h2>
            <div className="mt-4 prose-sm">
              <Markdown source={project.vision_content} />
            </div>
            {project.pdf_url && (
              <p className="mt-6 text-sm">
                <a
                  href={project.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-stone-900"
                >
                  Download the full document (PDF)
                </a>
              </p>
            )}
          </section>

          {/* Section 2: The Model */}
          <section>
            <h2 className="text-xl font-semibold">The model</h2>
            <p className="mt-1 text-sm text-stone-600">
              How the financial structure works. <strong>No money changes
              hands through this site.</strong> The numbers below are a working
              model showing how the community could fund the project together.
            </p>

            {financialTiers.length > 0 && (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-stone-300 text-left text-xs uppercase tracking-wide text-stone-500">
                      <th className="py-2 pr-4 font-medium">Tier</th>
                      <th className="py-2 pr-4 font-medium">Upfront</th>
                      <th className="py-2 pr-4 font-medium">Monthly</th>
                      <th className="py-2 pr-4 font-medium">Total</th>
                      <th className="py-2 pr-4 font-medium">Slots (target)</th>
                      <th className="py-2 font-medium">Phase choice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialTiers.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-stone-200 text-stone-800"
                      >
                        <td className="py-2 pr-4 font-medium">{t.name}</td>
                        <td className="py-2 pr-4">{formatGBP(t.upfront_amount)}</td>
                        <td className="py-2 pr-4">
                          {t.monthly_amount > 0
                            ? `${formatGBP(t.monthly_amount)}/month × ${t.monthly_duration_months}`
                            : 'None'}
                        </td>
                        <td className="py-2 pr-4">{formatGBP(t.total_amount)}</td>
                        <td className="py-2 pr-4">{t.target_slots}</td>
                        <td className="py-2 text-stone-600">
                          {t.phase_choice
                            ? 'Choose your phase'
                            : 'Allocated as available'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Live summary */}
            <div className="mt-6 rounded border border-stone-200 bg-stone-50 p-4 text-sm">
              <p className="text-stone-700">
                Target: <span className="font-medium">{formatGBP(project.funding_target)}</span>{' '}
                from{' '}
                <span className="font-medium">
                  {financialTiers.reduce((acc, t) => acc + t.target_slots, 0)}
                </span>{' '}
                members
              </p>
              <p className="mt-1 text-stone-700">
                Registered interest so far:{' '}
                <span className="font-medium">{totalCount}</span>{' '}
                {totalCount === 1 ? 'person' : 'people'}
              </p>
            </div>

            {/* Tier breakdown bars */}
            {tiers.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-stone-700">
                  Where current registrations sit
                </h3>
                <ul className="mt-3 space-y-2">
                  {tiers.map((t) => {
                    const count = tierCounts.get(t.id) ?? 0
                    const pct = Math.min(
                      100,
                      Math.round((count / Math.max(1, t.target_slots)) * 100)
                    )
                    return (
                      <li key={t.id}>
                        <div className="flex items-baseline justify-between text-xs text-stone-600">
                          <span className="font-medium text-stone-700">
                            {t.name}
                          </span>
                          <span>
                            {count} / {t.target_slots} ({pct}%)
                          </span>
                        </div>
                        <div className="mt-1 h-2 w-full rounded bg-stone-200 overflow-hidden">
                          <div
                            className="h-full bg-stone-700"
                            style={{ width: `${pct}%` }}
                            aria-hidden
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {/* Model markdown */}
            <div className="mt-8 prose-sm">
              <Markdown source={project.model_content} />
            </div>
          </section>

          {/* Section 3: Register interest */}
          <section>
            <h2 className="text-xl font-semibold">Register interest</h2>
            <p className="mt-1 text-sm text-stone-600">
              Tell us which tier you&rsquo;d be considering. Your individual
              answers are private — only you and the project creator can see
              them. The public summary above shows only counts.
            </p>
            {tiers.length === 0 ? (
              <p className="mt-4 text-sm text-stone-500">
                No tiers have been published yet for this project.
              </p>
            ) : isCancelled ? (
              <p className="mt-4 text-sm text-stone-500">
                Registration is closed for this project.
              </p>
            ) : (
              <div className="mt-4">
                <RegisterInterestSection
                  projectId={projectId}
                  tiers={tiers.map((t) => ({
                    id: t.id,
                    name: t.name,
                    display_order: t.display_order,
                  }))}
                  existing={
                    myRegistration
                      ? {
                          tier_id: myRegistration.tier_id,
                          skills_text: myRegistration.skills_text,
                          location_text: myRegistration.location_text,
                          motivation_text: myRegistration.motivation_text,
                          availability: myRegistration.availability,
                        }
                      : null
                  }
                />
              </div>
            )}
          </section>

          {/* Section 4: Progress updates */}
          <section>
            <h2 className="text-xl font-semibold">Progress updates</h2>
            {updates.length === 0 ? (
              <p className="mt-3 text-sm text-stone-500">
                No updates posted yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-10">
                {updates.map((upd) => {
                  const updPosts = updatePostsByUpdate.get(upd.id) ?? []
                  const updRoots = buildTree(updPosts)
                  const author = getDisplayUsername(
                    upd.author_id,
                    upd.users?.username ?? 'unknown',
                    adminIds
                  )
                  return (
                    <li
                      key={upd.id}
                      className="border-l-2 border-stone-200 pl-4"
                    >
                      <h3 className="text-base font-semibold">{upd.title}</h3>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {formatUpdateDate(upd.created_at)} · {author}
                      </p>
                      <div className="mt-3 prose-sm">
                        <Markdown source={upd.content} />
                      </div>

                      {/* Discussion thread for this update */}
                      <div className="mt-5">
                        {updRoots.length > 0 && (
                          <ul className="space-y-4">
                            {updRoots.map((node) => (
                              <li key={node.id}>{renderNode(node, common)}</li>
                            ))}
                          </ul>
                        )}
                        {!isCancelled && (
                          <div className="mt-4">
                            <ProjectRootReplyForm
                              projectId={projectId}
                              updateId={upd.id}
                              placeholder="Reply to this update"
                            />
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Section 5: Discussion */}
          <section>
            <h2 className="text-xl font-semibold">Discussion</h2>
            <p className="mt-1 text-sm text-stone-500">
              General discussion about the project, separate from the main site
              categories.
            </p>

            {mainDiscussionRoots.length === 0 && (
              <p className="mt-6 text-sm text-stone-500">No messages yet.</p>
            )}

            <ul className="mt-6 space-y-6">
              {mainDiscussionRoots.map((node) => (
                <li key={node.id}>{renderNode(node, common)}</li>
              ))}
            </ul>

            {!isCancelled && (
              <div className="mt-10 border-t border-stone-200 pt-6">
                <h3 className="text-sm font-medium text-stone-700">
                  Add a message
                </h3>
                <ProjectRootReplyForm projectId={projectId} updateId={null} />
              </div>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
