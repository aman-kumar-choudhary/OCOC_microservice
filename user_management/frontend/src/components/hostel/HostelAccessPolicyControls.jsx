import { Clock, Door, FloppyDisk, Sliders, SpinnerGap } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { hostelService } from "../../services/hostelService";

const Toggle = ({ enabled, onChange, label }) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={enabled}
    onClick={() => onChange(!enabled)}
    className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${enabled ? "bg-emerald-600" : "bg-slate-300"}`}
  >
    <span className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
  </button>
);

export default function HostelAccessPolicyControls() {
  const [policy, setPolicy] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    hostelService.getAccessPolicy().then(setPolicy).catch(() => setMessage("Could not load the gate policy."));
  }, []);

  const update = (field, value) => setPolicy((current) => ({ ...current, [field]: value }));
  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const updated = await hostelService.updateAccessPolicy(policy);
      setPolicy(updated);
      setMessage("Gate access policy saved.");
    } catch (error) {
      setMessage(error.response?.data?.detail || "Could not save the gate policy.");
    } finally {
      setSaving(false);
    }
  };

  if (!policy) return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading gate policy…</div>;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-5">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-[#0a2342]"><Sliders size={20} className="text-emerald-600" /> Campus Gate &amp; Access Policy Controls</h2>
        <p className="mt-0.5 text-xs text-slate-500">Set hostel curfew and visitor departure timings. All times use IST.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-bold"><Clock size={17} className="text-amber-600" /> Night Curfew Enforcement</span><Toggle enabled={policy.curfew_enabled} onChange={(value) => update("curfew_enabled", value)} label="Toggle night curfew" /></div>
          <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-slate-600">Starts<input type="time" value={policy.curfew_start} onChange={(event) => update("curfew_start", event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" /></label><label className="text-xs font-semibold text-slate-600">Ends<input type="time" value={policy.curfew_end} onChange={(event) => update("curfew_end", event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" /></label></div>
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-bold"><Door size={17} className="text-indigo-600" /> Visitor Departure Cut-off</span><Toggle enabled={policy.visitor_cutoff_enabled} onChange={(value) => update("visitor_cutoff_enabled", value)} label="Toggle visitor cut-off" /></div>
          <label className="block text-xs font-semibold text-slate-600">Visitors must depart by<input type="time" value={policy.visitor_cutoff} onChange={(event) => update("visitor_cutoff", event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" /></label>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3"><p className="text-xs text-emerald-700">{message}</p><button type="button" onClick={save} disabled={saving} className="btn btn-primary inline-flex items-center gap-2 px-4 text-xs"><>{saving ? <SpinnerGap className="animate-spin" size={15} /> : <FloppyDisk size={15} />}</> Save Policy</button></div>
    </section>
  );
}
