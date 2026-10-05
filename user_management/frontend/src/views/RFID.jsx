import React, { useState, useEffect, useCallback } from "react";
import rfidService from "@/services/rfidService";
import { formatDate } from "@/utils/date";
import {
  ArrowCounterClockwise,
  ArrowsClockwise,
  CaretLeft,
  CaretRight,
  CreditCard,
  ShieldSlash,
  SpinnerGap,
  Warning,
  X
} from "@phosphor-icons/react";
import AssignRFIDModal from "@/components/AssignRFIDModal";
import Pagination from "@/components/common/Pagination";
import { useToast } from "@/context/ToastContext";

export const RFIDView = () => {
  const { toast } = useToast();
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [serviceStatus, setServiceStatus] = useState("checking"); // 'connected' | 'disconnected' | 'checking'
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeLoading, setRevokeLoading] = useState(false);

  const [filters, setFilters] = useState({ status: "" });

  const fetchCards = useCallback(
    async (customPage, customLimit) => {
      setIsLoading(true);
      try {
        const data = await rfidService.list({
          page: customPage ?? page,
          limit: customLimit ?? limit,
          ...filters,
        });
        setCards(data.cards || []);
        setTotal(data.total);
        setTotalPages(data.total_pages);
        setServiceStatus("connected");
      } catch (e) {
        console.error(e);
        setServiceStatus("disconnected");
      } finally {
        setIsLoading(false);
      }
    },
    [page, limit, filters],
  );

  useEffect(() => {
    fetchCards(1);
  }, [filters.status]);

  const doRevoke = async () => {
    if (!revokeTarget) return;
    setRevokeLoading(true);
    try {
      await rfidService.revoke(revokeTarget.id, revokeReason);
      toast.success("RFID card successfully revoked.");
      setRevokeTarget(null);
      setRevokeReason("");
      fetchCards();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error?.message || "Failed to revoke card.");
    } finally {
      setRevokeLoading(false);
    }
  };

  const statusBadge = (s) => {
    if (s === "active") return "badge-active";
    if (s === "inactive") return "badge-suspended";
    if (s === "replaced") return "text-blue-600 bg-blue-100";
    return "badge-deactivated";
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">RFID Directory</h1>
          <p className="text-muted text-sm mt-1">
            Manage hardware tokens, lifecycle, and replacement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              serviceStatus === "connected"
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                : serviceStatus === "disconnected"
                ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                : "bg-slate-100 text-slate-600 border-slate-200"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                serviceStatus === "connected"
                  ? "bg-emerald-500 animate-pulse"
                  : serviceStatus === "disconnected"
                  ? "bg-rose-500"
                  : "bg-slate-400"
              }`}
            ></span>{" "}
            {serviceStatus === "connected"
              ? "Service Connected"
              : serviceStatus === "disconnected"
              ? "Service Offline"
              : "Checking..."}
          </div>
          <button
            onClick={() => fetchCards()}
            className="btn btn-outline py-1.5 px-3"
            id="rfid-refresh-btn"
          >
            <ArrowsClockwise size={15} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          { v: "", l: "All" },
          { v: "active", l: "Active" },
          { v: "inactive", l: "Inactive" },
          { v: "revoked", l: "Revoked" },
          { v: "lost", l: "Lost" },
          { v: "replaced", l: "Replaced" },
        ].map((s) => (
          <button
            key={s.v}
            onClick={() => {
              setFilters({ status: s.v });
              setPage(1);
            }}
            className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-all ${
              filters.status === s.v
                ? "bg-[#0a2342] text-[#f5bd19] border-[#0a2342]"
                : "border-[var(--border-light)] text-muted hover:border-[#f5bd19]"
            }`}
          >
            {s.l}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="table-container relative">
        {isLoading && (
          <div className="absolute inset-0 bg-[var(--bg-card)]/70 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
            <SpinnerGap className="animate-spin text-[#f5bd19]" size={28} />
          </div>
        )}

        <table className="table min-w-full">
          <thead>
            <tr>
              <th>UID</th>
              <th>Assigned User</th>
              <th>Status</th>
              <th>Issued</th>
              <th>Revoked</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cards.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-muted">
                  <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No RFID cards found</p>
                </td>
              </tr>
            ) : (
              cards.map((card) => (
                <tr key={card.id}>
                  {/* UID */}
                  <td>
                    <span className="font-mono font-bold tracking-widest text-sm">
                      {card.uid}
                    </span>
                    <div className="text-[10px] text-muted font-mono mt-0.5">
                      {card.id.substring(0, 12)}…
                    </div>
                  </td>

                  {/* Assigned User */}
                  <td>
                    {card.user_email ? (
                      <span className="text-sm font-semibold">
                        {card.user_email}
                      </span>
                    ) : (
                      <span className="text-xs text-muted italic">
                        Unassigned
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td>
                    <span className={`badge ${statusBadge(card.status)}`}>
                      {card.status}
                    </span>
                  </td>

                  {/* Issued */}
                  <td className="text-sm text-muted">
                    {formatDate(card.issued_at || card.created_at)}
                  </td>

                  {/* Revoked */}
                  <td className="text-sm text-muted">
                    {card.revoked_at ? (
                      <div>
                        <span>{formatDate(card.revoked_at)}</span>
                        {card.revoked_reason && (
                          <div className="text-xs text-red-600 font-semibold">
                            {card.revoked_reason}
                          </div>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>

                  {/* Actions */}
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {card.status === "active" && (
                        <>
                          <button
                            onClick={() => setReplaceTarget(card)}
                            className="p-1.5 rounded-lg border border-[var(--border-light)] text-muted hover:text-[#0a2342] hover:border-[#f5bd19] transition-colors text-xs font-semibold flex items-center gap-1"
                            title="Replace card"
                          >
                            <ArrowCounterClockwise size={14} /> Replace
                          </button>
                          <button
                            onClick={() => setRevokeTarget(card)}
                            className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors text-xs font-semibold flex items-center gap-1"
                            title="Revoke card"
                          >
                            <ShieldSlash size={14} /> Revoke
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="p-4 border-t border-[var(--border-light)] bg-white rounded-b-2xl">
          <Pagination
            currentPage={page}
            totalItems={total}
            pageSize={limit}
            onPageChange={(p) => {
              setPage(p);
              fetchCards(p, limit);
            }}
            onPageSizeChange={(sz) => {
              setLimit(sz);
              setPage(1);
              fetchCards(1, sz);
            }}
            pageSizeOptions={[10, 20, 50]}
          />
        </div>
      </div>

      {/* Revoke Modal */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setRevokeTarget(null)}
          />
          <div className="relative z-10 glass-panel w-full max-w-md p-6 shadow-2xl page-enter space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-light)] pb-3">
              <div className="flex items-center gap-2 text-red-600 font-bold">
                <Warning size={20} /> Revoke RFID Tag
              </div>
              <button
                onClick={() => setRevokeTarget(null)}
                className="p-1 rounded-lg text-muted"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm">
              Are you sure you want to revoke card{" "}
              <strong className="font-mono">{revokeTarget.uid}</strong>? This
              action will disable immediate access.
            </p>

            <div>
              <label className="form-label">Reason for revocation</label>
              <select
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                className="form-input form-select"
              >
                <option value="lost">Lost</option>
                <option value="stolen">Stolen</option>
                <option value="damaged">Damaged</option>
                <option value="administrative">
                  Administrative revocation
                </option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setRevokeTarget(null)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={doRevoke}
                disabled={revokeLoading}
                className="btn btn-danger"
              >
                {revokeLoading ? (
                  <SpinnerGap className="animate-spin" size={15} />
                ) : (
                  <ShieldSlash size={15} />
                )}
                Confirm Revocation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replace Modal */}
      {replaceTarget && (
        <AssignRFIDModal
          card={replaceTarget}
          onClose={() => setReplaceTarget(null)}
          onDone={() => {
            setReplaceTarget(null);
            fetchCards();
          }}
        />
      )}
    </div>
  );
};

export default RFIDView;
