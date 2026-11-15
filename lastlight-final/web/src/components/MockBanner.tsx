import { useMockFlag } from '../data/hooks'

export function MockBanner() {
  const mock = useMockFlag()
  if (!mock) return null
  return (
    <div className="mock-banner" role="status">
      <strong>Mock data</strong> Numbers on this page are placeholders until our terrain pipeline finishes. Don’t quote them.
    </div>
  )
}
