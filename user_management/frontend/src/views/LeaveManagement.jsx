import React, { useEffect, useState } from 'react'
import api from '@/services/api'
import { useAuth } from '@/context/AuthContext'

const statusColor = { DRAFT: 'bg-slate-100 text-slate-700', PENDING_APPROVAL: 'bg-amber-100 text-amber-800', APPROVED: 'bg-emerald-100 text-emerald-800', REJECTED: 'bg-rose-100 text-rose-800', WITHDRAWN: 'bg-slate-100 text-slate-600', EXPIRED: 'bg-orange-100 text-orange-800', COMPLETED: 'bg-blue-100 text-blue-800' }
const emptyForm = { leave_type_id: '', start_at: '', end_at: '', destination: '', reason: '', custom_reason: '' }

export default function LeaveManagement() {
  const { roles } = useAuth()
  const roleSet = new Set(roles.map((r) => String(r).toUpperCase()))
  const isApprover = ['SUPER_ADMIN', 'WARDEN', 'CHANCELLOR', 'MEDICAL_OFFICER'].some((r) => roleSet.has(r))
  const isAdmin = roleSet.has('SUPER_ADMIN')
  const [types, setTypes] = useState([])
  const [requests, setRequests] = useState([])
  const [pending, setPending] = useState([])
  const [balances, setBalances] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [workflowType, setWorkflowType] = useState('')
  const [workflowText, setWorkflowText] = useState('')

  const refresh = async () => {
    const [t, r, b, p] = await Promise.all([
      api.get('/leave/types'), api.get('/leave/requests'), api.get('/leave/balances/me'),
      isApprover ? api.get('/leave/approvals/pending') : Promise.resolve({ data: { data: [] } }),
    ])
    setTypes(t.data.data || []); setRequests(r.data.data || []); setBalances(b.data.data || []); setPending(p.data.data || [])
  }
  useEffect(() => { refresh().catch((e) => setError(e.response?.data?.error?.message || 'Unable to load leave data')) }, [])

  const submit = async (event) => {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true)
    try {
      const payload = { ...form, start_at: new Date(form.start_at).toISOString(), end_at: new Date(form.end_at).toISOString() }
      await api.post('/leave/requests?draft=false', payload)
      setForm(emptyForm); setNotice('Leave request submitted.'); await refresh()
    } catch (e) { setError(e.response?.data?.error?.message || e.response?.data?.detail || 'Could not submit leave request') }
    finally { setBusy(false) }
  }
  const saveDraft = async () => {
    setError(''); setNotice('')
    if (!form.leave_type_id || !form.start_at || !form.end_at || !form.destination.trim() || !form.reason.trim()) {
      setError('Complete the required fields before saving a draft.'); return
    }
    try {
      const payload = { ...form, start_at: new Date(form.start_at).toISOString(), end_at: new Date(form.end_at).toISOString() }
      await api.post('/leave/requests?draft=true', payload)
      setForm(emptyForm); setNotice('Draft saved.'); await refresh()
    } catch (e) { setError(e.response?.data?.error?.message || 'Could not save draft') }
  }
  const decide = async (id, action) => {
    const comment = action === 'reject' ? window.prompt('Rejection reason (required):') : ''
    if (action === 'reject' && !comment?.trim()) return
    try { await api.post(`/leave/requests/${id}/${action}`, { comment }); setNotice(`Request ${action}d.`); await refresh() }
    catch (e) { setError(e.response?.data?.error?.message || 'Approval action failed') }
  }
  const withdraw = async (id) => {
    try { await api.post(`/leave/requests/${id}/withdraw`, { comment: '' }); await refresh() }
    catch (e) { setError(e.response?.data?.error?.message || 'Could not withdraw request') }
  }
  const saveWorkflow = async (event) => {
    event.preventDefault(); setError('')
    try {
      await api.put(`/leave/types/${workflowType}/workflow`, { workflow: workflowText.split(',').map((p) => p.trim()).filter(Boolean) })
      setNotice('Approval workflow saved for new requests.'); await refresh()
    } catch (e) { setError(e.response?.data?.error?.message || 'Could not save workflow') }
  }

  return <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
    <header><p className="text-xs font-bold uppercase tracking-widest text-amber-600">OCOC • Student Services</p><h1 className="mt-1 text-3xl font-extrabold text-slate-900">Leave Management</h1><p className="mt-2 text-slate-600">Apply for campus leave and follow each approval through to your return.</p></header>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800">{error}</div>}
    {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">{notice}</div>}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,.8fr)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Apply for leave</h2>
        <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Leave type<select required value={form.leave_type_id} onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 p-3"><option value="">Select leave type</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-700">Start date and time<input required type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 p-3" /></label>
          <label className="text-sm font-semibold text-slate-700">End date and time<input required type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 p-3" /></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Destination<input required maxLength="300" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 p-3" placeholder="Where are you going?" /></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Reason / justification<textarea required maxLength="4000" rows="3" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 p-3" /></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Other / custom reason (optional)<input maxLength="1000" value={form.custom_reason} onChange={(e) => setForm({ ...form, custom_reason: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 p-3" /></label>
          <div className="flex flex-wrap gap-3 sm:col-span-2"><button type="button" onClick={saveDraft} className="rounded-lg border border-slate-300 px-5 py-3 font-bold text-slate-700 hover:bg-slate-50">Save as draft</button><button disabled={busy} className="rounded-lg bg-[#0a2342] px-5 py-3 font-bold text-white hover:bg-[#12375f] disabled:opacity-60">{busy ? 'Submitting…' : 'Submit leave request'}</button></div>
        </form>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-900">My balances</h2>{balances.length ? <div className="mt-4 space-y-3">{balances.map((b) => <div key={b.id} className="rounded-lg bg-slate-50 p-4"><div className="font-semibold">{b.leave_type}</div><div className="mt-1 text-sm text-slate-600">{b.academic_period} · {Math.max(0, Number(b.allowed_days) - Number(b.consumed_days))} days remaining of {b.allowed_days}</div></div>)}</div> : <p className="mt-4 text-sm text-slate-500">No leave balances are configured for your account.</p>}</section>
    </div>
    {isApprover && <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Pending approvals <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-sm text-amber-800">{pending.length}</span></h2><div className="mt-4 space-y-3">{pending.map((r) => <article key={r.id} className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center"><div><div className="font-bold">{r.student_name} · {r.leave_type}</div><div className="text-sm text-slate-600">{r.destination} · {new Date(r.start_at).toLocaleString()} – {new Date(r.end_at).toLocaleString()}</div><div className="mt-1 text-sm">{r.reason}</div></div><div className="flex gap-2"><button onClick={() => decide(r.id, 'approve')} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Approve</button><button onClick={() => decide(r.id, 'reject')} className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-bold text-rose-700">Reject</button></div></article>)}</div>{!pending.length && <p className="mt-4 text-sm text-slate-500">No requests need your approval.</p>}</section>}
    {isAdmin && <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Workflow configuration</h2><form onSubmit={saveWorkflow} className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto]"><select required value={workflowType} onChange={(e) => { const selected = types.find((t) => t.id === e.target.value); setWorkflowType(e.target.value); setWorkflowText(Array.isArray(selected?.workflow) ? selected.workflow.join(', ') : typeof selected?.workflow === 'string' ? JSON.parse(selected.workflow).join(', ') : '') }} className="rounded-lg border border-slate-300 p-3"><option value="">Choose a leave type</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select><input required value={workflowText} onChange={(e) => setWorkflowText(e.target.value)} className="rounded-lg border border-slate-300 p-3" placeholder="leave.approve.warden, leave.approve.chancellor" /><button disabled={!workflowType} className="rounded-lg bg-[#0a2342] px-4 py-3 font-bold text-white disabled:opacity-50">Save stages</button></form><p className="mt-2 text-xs text-slate-500">Enter permission stages in order, separated by commas. Existing requests keep their workflow snapshot.</p></section>}
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-900">{isAdmin ? 'Leave requests' : 'My leave requests'}</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="p-3">Type / ID</th><th className="p-3">Period</th><th className="p-3">Destination</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{requests.map((r) => <tr key={r.id} className="border-b last:border-0"><td className="p-3"><div className="font-semibold">{r.leave_type}</div><div className="text-xs text-slate-400">{r.id.slice(0, 8)}</div></td><td className="p-3">{new Date(r.start_at).toLocaleString()}<br />{new Date(r.end_at).toLocaleString()}</td><td className="p-3">{r.destination}</td><td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusColor[r.status] || ''}`}>{r.status.replaceAll('_', ' ')}</span></td><td className="p-3">{['DRAFT','PENDING_APPROVAL'].includes(r.status) && <button onClick={() => withdraw(r.id)} className="font-semibold text-rose-700">Withdraw</button>}</td></tr>)}</tbody></table>{!requests.length && <p className="p-4 text-slate-500">No leave requests yet.</p>}</div></section>
  </div>
}
