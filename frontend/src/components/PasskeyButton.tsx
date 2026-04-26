import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Fingerprint, Loader2 } from 'lucide-react'
import { browserSupportsWebAuthn, isUserCancellation } from '@/lib/passkey'
import { toast } from 'sonner'

interface Props {
  label: string
  onClick: () => Promise<void>
  variant?: 'default' | 'outline'
  className?: string
  disabled?: boolean
  testId?: string
}

export function PasskeyButton({ label, onClick, variant = 'default', className, disabled, testId }: Props) {
  const [loading, setLoading] = useState(false)
  const supported = browserSupportsWebAuthn()
  const handleClick = async () => {
    if (!supported || loading) return
    setLoading(true)
    try {
      await onClick()
    } catch (err) {
      if (!isUserCancellation(err)) {
        toast.error(err instanceof Error ? err.message : 'Passkey request failed')
      }
    } finally {
      setLoading(false)
    }
  }
  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={disabled || loading || !supported}
      onClick={handleClick}
      data-testid={testId}
      title={!supported ? 'Passkeys are not supported in this browser' : undefined}
    >
      {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Fingerprint className="size-4 mr-2" />}
      {label}
    </Button>
  )
}
