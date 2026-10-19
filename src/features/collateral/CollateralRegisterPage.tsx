import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Unlock } from 'lucide-react'
import { getApi } from '@/api/provider'
import { PageHeader, Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Badge } from '@/ui/Badge'
import { Modal, ConfirmDialog } from '@/ui/Modal'
import { Field, Input } from '@/ui/Input'
import { PhotoGallery } from '@/ui/Photo'
import { EmptyState, ErrorState, SkeletonTable } from '@/ui/States'
import { useToast } from '@/ui/Toast'
import { formatDate } from '@/lib/dates'
import { FINANCE_TYPE_LABELS } from '@/lib/format'
import { useAuth } from '@/features/auth/AuthProvider'
import type { CollateralRegisterEntry } from '@/domain/types'

export default function CollateralRegisterPage() {
  const { can } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'all' | 'held' | 'released'>('held')
  const [releaseTarget, setReleaseTarget] = useState<CollateralRegisterEntry | null>(null)
  const [releaseNote, setReleaseNote] = useState('')
  const [addPhotosFor, setAddPhotosFor] = useState<CollateralRegisterEntry | null>(null)
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['collateral', statusFilter],
    queryFn: () => getApi().listCollateral({ status: statusFilter === 'all' ? undefined : statusFilter }),
  })

  async function confirmRelease() {
    if (!releaseTarget) return
    if (!releaseNote.trim()) {
      toast.error('Release note required', 'Record what was returned and to whom (COL-005).')
      return
    }
    setBusy(true)
    try {
      await getApi().releaseCollateral(releaseTarget.collateral.id, releaseNote.trim())
      qc.invalidateQueries({ queryKey: ['collateral'] }).catch(() => {})
      toast.success('Collateral released', 'Release recorded with your confirmation.')
      setReleaseTarget(null)
      setReleaseNote('')
    } catch (err) {
      toast.error('Could not release collateral', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  async function addPhotos() {
    if (!addPhotosFor || newFiles.length === 0) return
    setBusy(true)
    try {
      await getApi().addCollateralPhotos(addPhotosFor.collateral.id, newFiles)
      qc.invalidateQueries({ queryKey: ['collateral'] }).catch(() => {})
      toast.success('Photos added')
      setAddPhotosFor(null)
      setNewFiles([])
    } catch (err) {
      toast.error('Could not add photos', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Collateral register"
        subtitle="All pledged items and documents, with photo references and release status (COL-004)."
        actions={
          <div className="inline-flex rounded-md border border-border-strong bg-surface p-0.5" role="group" aria-label="Filter by status">
            {(['held', 'released', 'all'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                aria-pressed={statusFilter === s}
                className={`rounded px-2.5 py-1 text-xs font-medium capitalize ${statusFilter === s ? 'bg-brand-700 text-white' : 'text-text-secondary hover:bg-ink-100 dark:hover:bg-ink-800'}`}
              >
                {s}
              </button>
            ))}
          </div>
        }
      />

      {isLoading && <SkeletonTable rows={4} cols={3} />}
      {error && <ErrorState message={error instanceof Error ? error.message : 'Failed to load register.'} onRetry={() => void refetch()} />}

      {data && data.items.length === 0 && (
        <Card>
          <EmptyState
            icon={<Camera className="size-8" aria-hidden />}
            title={`No ${statusFilter === 'all' ? '' : statusFilter} collateral`}
            description="Collateral records are created together with collateral-backed accounts."
          />
        </Card>
      )}

      {data && data.items.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.items.map((entry) => (
            <Card key={entry.collateral.id} className="overflow-hidden">
              <div className="border-b border-border-base px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/accounts/${entry.collateral.accountId}`} className="text-sm font-semibold text-text-primary hover:underline">
                      {entry.customerName}
                    </Link>
                    <p className="text-xs text-text-muted">
                      {FINANCE_TYPE_LABELS[entry.financeType]} account
                      {entry.collateral.reference ? ` · Ref ${entry.collateral.reference}` : ''}
                    </p>
                  </div>
                  <Badge tone={entry.collateral.status === 'held' ? 'info' : 'neutral'}>
                    {entry.collateral.status === 'held' ? 'Held' : `Released ${entry.collateral.releasedAt ? formatDate(entry.collateral.releasedAt) : ''}`}
                  </Badge>
                </div>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-text-primary">{entry.collateral.description}</p>
                <p className="mt-0.5 text-xs text-text-muted">Recorded {formatDate(entry.collateral.recordedAt)}</p>
                {entry.collateral.releaseNote && (
                  <p className="mt-1 text-xs text-text-secondary">Release note: {entry.collateral.releaseNote}</p>
                )}
                <div className="mt-3">
                  <PhotoGallery photos={entry.collateral.photos} emptyLabel="No photos — add at least one for collateral-backed accounts." />
                </div>
                {can('collateral:write') && (
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" icon={<Camera className="size-3.5" aria-hidden />} onClick={() => setAddPhotosFor(entry)}>
                      Add photos
                    </Button>
                    {can('collateral:release') && entry.collateral.status === 'held' && (
                      <Button variant="ghost" size="sm" icon={<Unlock className="size-3.5" aria-hidden />} onClick={() => setReleaseTarget(entry)}>
                        Mark released
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!releaseTarget}
        onClose={() => setReleaseTarget(null)}
        onConfirm={() => void confirmRelease()}
        title="Confirm collateral release"
        loading={busy}
        confirmLabel="Confirm release"
        message={
          <>
            <p>
              Confirm that the following item was physically returned to{' '}
              <strong>{releaseTarget?.customerName}</strong>:
            </p>
            <p className="font-medium">{releaseTarget?.collateral.description}</p>
            <div className="mt-3">
              <Field label="Release note" htmlFor="release-note" required hint="e.g. Returned gold necklace to Ramesh Kumar in person on …">
                <Input
                  id="release-note"
                  value={releaseNote}
                  onChange={(e) => setReleaseNote(e.target.value)}
                  placeholder="Who received what, when, and where"
                />
              </Field>
            </div>
          </>
        }
      />

      <Modal
        open={!!addPhotosFor}
        onClose={() => setAddPhotosFor(null)}
        title="Add collateral photos"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddPhotosFor(null)}>Cancel</Button>
            <Button onClick={() => void addPhotos()} loading={busy} disabled={newFiles.length === 0}>
              Upload {newFiles.length > 0 ? `(${newFiles.length})` : ''}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-xs text-text-secondary">
          {addPhotosFor?.collateral.description} — photos are protected and included in backup/recovery (COL-006).
        </p>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(e) => setNewFiles(Array.from(e.target.files ?? []))}
          className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-800"
        />
        {newFiles.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-text-muted">
            {newFiles.map((f, i) => (
              <li key={i}>{f.name}</li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  )
}
