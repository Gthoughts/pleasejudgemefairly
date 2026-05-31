import RegionLanding from '@/components/RegionLanding'

// The Accord — TheAccord.cc landing. No region specified, so the page
// reads as the generic "The Accord". If a future regional page wants
// e.g. "The Merseyside Accord" / TheAccord.cc/Merseyside, it renders
// <RegionLanding region="Merseyside" /> with its own value.
export default function HomePage() {
  return <RegionLanding />
}
