import RegionLanding from '@/components/RegionLanding'

// The /Merseyside landing as the site default for Phase 2 of the rebrand.
// When other counties get their own routes in a later phase, each new
// page will render <RegionLanding region="..." /> with its own value.
export default function HomePage() {
  return <RegionLanding region="Merseyside" />
}
