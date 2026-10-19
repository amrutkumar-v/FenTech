import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { getApi } from '@/api/provider'
import { newId } from '@/lib/ids'
import { PageHeader, Card, CardBody } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Field, Input, Textarea } from '@/ui/Input'
import { PhotoInput } from '@/ui/Photo'
import { useToast } from '@/ui/Toast'
import { useOfflineAction } from '@/offline/useOfflineAction'
import { LoadingState, ErrorState } from '@/ui/States'
import type { Customer } from '@/domain/types'

export default function CustomerFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()

  const existing = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getApi().getCustomer(id!),
    enabled: editing,
  })

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [dupAck, setDupAck] = useState(false)

  useEffect(() => {
    if (existing.data) {
      setName(existing.data.name)
      setPhone(existing.data.phone)
      setAddress(existing.data.address ?? '')
      setNotes(existing.data.notes ?? '')
    }
  }, [existing.data])

  // Duplicate check (CUS-004): warn — operator reviews before creating another profile.
  const { data: dups } = useQuery({
    queryKey: ['customer-dups', name, phone],
    queryFn: () => getApi().findDuplicateCustomers(name, phone),
    enabled: !editing && name.trim().length >= 3 && phone.replace(/\D/g, '').length >= 6,
  })
  const duplicateCandidates = useMemo(
    () => (dups ?? []).filter((c) => c.id !== id),
    [dups, id],
  )

  const createAction = useOfflineAction<
    { id: string; name: string; phone: string; address: string; notes: string; photoFile: File | null },
    Customer
  >({
    kind: 'create_customer',
    online: (input) =>
      getApi().createCustomer({
        id: input.id,
        name: input.name,
        phone: input.phone,
        address: input.address || undefined,
        notes: input.notes || undefined,
        photoFile: input.photoFile ?? undefined,
      }),
    toPayload: (input) => input,
    invalidate: [['customers']],
  })

  const updateAction = useOfflineAction<
    { name: string; phone: string; address: string; notes: string; photoFile: File | null; removePhoto: boolean },
    Customer
  >({
    kind: 'update_customer',
    online: (input) =>
      getApi().updateCustomer(id!, {
        name: input.name,
        phone: input.phone,
        address: input.address || undefined,
        notes: input.notes || undefined,
        photoFile: input.photoFile ?? undefined,
        removePhoto: input.removePhoto || undefined,
      }),
    toPayload: (input) => ({ id, ...input }),
    invalidate: [['customers'], ['customer', id ?? '']],
  })

  function validate(): boolean {
    const fe: Record<string, string> = {}
    if (!name.trim()) fe.name = 'Customer name is required (CUS-001).'
    if (!phone.trim()) fe.phone = 'Phone number is required (CUS-001, BR-001).'
    else if (phone.replace(/\D/g, '').length < 10) fe.phone = 'Enter a valid phone number (at least 10 digits).'
    setFieldErrors(fe)
    return Object.keys(fe).length === 0
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return
    try {
      if (editing) {
        const res = await updateAction.run({ name, phone, address, notes, photoFile: photo, removePhoto })
        toast.success(
          res.pendingSync ? 'Customer saved on this device' : 'Customer updated',
          res.pendingSync
            ? 'This record is PENDING SYNC and is not yet confirmed by the central database.'
            : undefined,
        )
        navigate(`/customers/${id}`)
      } else {
        const res = await createAction.run({
          id: newId('cus'),
          name,
          phone,
          address,
          notes,
          photoFile: photo,
        })
        toast.success(
          res.pendingSync ? 'Customer saved on this device' : 'Customer created',
          res.pendingSync
            ? 'This record is PENDING SYNC and is not yet confirmed by the central database.'
            : undefined,
        )
        navigate(res.data ? `/customers/${res.data.id}` : '/')
      }
    } catch {
      /* error surfaced via action.error + toast below */
      const err = createAction.error ?? updateAction.error
      toast.error('Could not save customer', err?.message)
    }
  }

  if (editing && existing.isLoading) return <LoadingState label="Loading customer…" />
  if (editing && existing.error) {
    return <ErrorState message={existing.error instanceof Error ? existing.error.message : 'Not found.'} />
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={editing ? 'Edit customer' : 'New customer'}
        subtitle={editing ? undefined : 'Name and phone number are required. A photo is optional.'}
        back={
          <Link
            to={editing ? `/customers/${id}` : '/customers'}
            className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-primary"
          >
            <ArrowLeft className="size-3.5" aria-hidden /> Back
          </Link>
        }
      />

      <Card>
        <CardBody>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {!editing && duplicateCandidates.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
                  <div className="min-w-0 text-xs text-amber-900 dark:text-amber-200">
                    <p className="font-semibold">Possible duplicate customer (CUS-004)</p>
                    <ul className="mt-1.5 space-y-1">
                      {duplicateCandidates.slice(0, 4).map((c) => (
                        <li key={c.id}>
                          <Link to={`/customers/${c.id}`} className="font-medium underline underline-offset-2">
                            {c.name}
                          </Link>{' '}
                          · {c.phone} · {c.accounts.length} account(s)
                        </li>
                      ))}
                    </ul>
                    <label className="mt-2 flex items-center gap-2 font-medium">
                      <input
                        type="checkbox"
                        checked={dupAck}
                        onChange={(e) => setDupAck(e.target.checked)}
                        className="size-4 rounded border-amber-400"
                      />
                      I reviewed these — still create a new profile
                    </label>
                  </div>
                </div>
              </div>
            )}

            <Field label="Full name" htmlFor="name" required error={fieldErrors.name}>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                invalid={!!fieldErrors.name}
                autoComplete="off"
                placeholder="e.g. Ramesh Kumar"
              />
            </Field>

            <Field
              label="Phone number"
              htmlFor="phone"
              required
              error={fieldErrors.phone}
              hint="Required. Used to identify the customer and avoid duplicates."
            >
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                invalid={!!fieldErrors.phone}
                placeholder="+91 98765 43210"
              />
            </Field>

            <Field label="Address" htmlFor="address" hint="Optional">
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>

            <Field label="Notes" htmlFor="notes" hint="Optional — anything worth remembering about this customer">
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>

            <PhotoInput
              label="Customer photo"
              hint="Optional for all account types (COL-003). Photos are included in backup and recovery."
              value={photo}
              onChange={(f) => {
                setPhoto(f)
                if (f) setRemovePhoto(false)
              }}
            />

            {editing && existing.data?.photo?.url && !photo && (
              <div>
                <p className="mb-1 text-xs font-medium text-text-muted">Current photo</p>
                <div className="flex items-center gap-3">
                  <img src={existing.data.photo.url} alt="Current customer" className="size-16 rounded-lg object-cover" />
                  {!removePhoto && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setRemovePhoto(true)}>
                      Remove photo
                    </Button>
                  )}
                  {removePhoto && (
                    <p className="text-xs text-text-secondary">
                      Photo will be removed on save.{' '}
                      <button type="button" className="underline" onClick={() => setRemovePhoto(false)}>
                        Undo
                      </button>
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                loading={createAction.busy || updateAction.busy}
                disabled={!editing && duplicateCandidates.length > 0 && !dupAck}
              >
                {editing ? 'Save changes' : 'Create customer'}
              </Button>
              <Link to={editing ? `/customers/${id}` : '/customers'}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
