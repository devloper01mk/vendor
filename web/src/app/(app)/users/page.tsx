"use client";

import { ApiError } from "@/core/api/http";
import { useApi } from "@/core/use-api";
import { useAuthStore } from "@/features/auth/auth.store";
import { AppSelect } from "@/components/ui/AppSelect";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type UserRow = { id: string; email: string; name: string; role: string; isBlocked: boolean; createdAt: string };
type UserPaymentRow = {
  id: string;
  amount: string;
  paidAt: string;
  method?: string | null;
  note?: string | null;
  requirement: {
    id: string;
    itemName: string;
    totalAmount: string;
    paidTotal: string;
    remaining: string;
    status: string;
  };
  recordedBy: { id: string; name: string; email: string };
};
type UserPaymentResponse = {
  user: UserRow;
  summary: {
    totalAmount: string;
    totalPaid: string;
    remainingAmount: string;
  };
  requirements: {
    id: string;
    itemName: string;
    totalAmount: string;
    paidTotal: string;
    remaining: string;
    status: string;
    entryDate: string;
  }[];
  payments: UserPaymentRow[];
};

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Session expired or not signed in. Please log in again.";
    if (err.status === 403) return "You do not have permission to view users.";
    return err.message || `Request failed (${err.status})`;
  }
  if (err instanceof Error) return err.message;
  return "Failed to load users.";
}

export default function UsersPage() {
  const api = useApi();
  const qc = useQueryClient();
  const authUser = useAuthStore((s) => s.user);
  const canManageUsers = authUser?.role === "ADMIN" || authUser?.role === "ACCOUNT_HEAD";
  const router = useRouter();
  useEffect(() => {
    if (!canManageUsers) router.replace("/dashboard");
  }, [canManageUsers, router]);

  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [editingPayment, setEditingPayment] = useState<UserPaymentRow | null>(null);
  const [addingForRequirement, setAddingForRequirement] = useState<{ id: string; itemName: string } | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("MEMBER");
  const [userPassword, setUserPassword] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [userUiError, setUserUiError] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editMethod, setEditMethod] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editPaidAt, setEditPaidAt] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addMethod, setAddMethod] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addPaidAt, setAddPaidAt] = useState("");
  const [addPaymentUiError, setAddPaymentUiError] = useState("");
  const q = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<UserRow[]>("/users"),
    enabled: canManageUsers,
  });

  const setBlocked = useMutation({
    mutationFn: async (vars: { id: string; blocked: boolean }) =>
      api.patch<UserRow>(`/users/${vars.id}/blocked`, { blocked: vars.blocked }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["users"] });
      const prev = qc.getQueryData<UserRow[]>(["users"]);
      if (prev) {
        qc.setQueryData<UserRow[]>(
          ["users"],
          prev.map((u) => (u.id === vars.id ? { ...u, isBlocked: vars.blocked } : u)),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["users"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const paymentQ = useQuery({
    queryKey: ["user-payments", selectedUser?.id],
    queryFn: () => api.get<UserPaymentResponse>(`/users/${selectedUser?.id}/payments`),
    enabled: Boolean(selectedUser?.id),
  });

  const updatePayment = useMutation({
    mutationFn: async (vars: { paymentId: string; amount: number; paidAt: string; method: string; note: string }) =>
      api.patch<UserPaymentRow>(`/users/payments/${vars.paymentId}`, {
        amount: vars.amount,
        paidAt: vars.paidAt,
        method: vars.method || undefined,
        note: vars.note || undefined,
      }),
    onSuccess: async () => {
      if (!selectedUser?.id) return;
      await qc.invalidateQueries({ queryKey: ["user-payments", selectedUser.id] });
      setEditingPayment(null);
    },
  });

  const addPayment = useMutation({
    mutationFn: async (vars: { amount: number; method: string; note: string; paidAt?: string }) =>
      api.post(`/users/${selectedUser?.id}/payments`, {
        amount: vars.amount,
        paidAt: vars.paidAt || undefined,
        method: vars.method || undefined,
        note: vars.note || undefined,
      }),
    onSuccess: async () => {
      if (!selectedUser?.id) return;
      await qc.invalidateQueries({ queryKey: ["user-payments", selectedUser.id] });
      setAddingForRequirement(null);
      setAddAmount("");
      setAddMethod("");
      setAddNote("");
      setAddPaidAt("");
      setAddPaymentUiError("");
    },
  });

  const deletePayment = useMutation({
    mutationFn: async (paymentId: string) => api.delete(`/users/payments/${paymentId}`),
    onSuccess: async () => {
      if (!selectedUser?.id) return;
      await qc.invalidateQueries({ queryKey: ["user-payments", selectedUser.id] });
    },
  });

  const createUser = useMutation({
    mutationFn: async (vars: { name: string; email: string; role: string; password: string }) =>
      api.post("/users", vars),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users"] });
      setCreateOpen(false);
      setUserName("");
      setUserEmail("");
      setUserRole("MEMBER");
      setUserPassword("");
      setUserUiError("");
    },
    onError: (err) => setUserUiError(errorMessage(err)),
  });

  const updateUser = useMutation({
    mutationFn: async (vars: { id: string; name: string; email: string; role: string }) =>
      api.patch(`/users/${vars.id}`, vars),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users"] });
      setEditingUser(null);
      setUserName("");
      setUserEmail("");
      setUserRole("MEMBER");
      setUserUiError("");
    },
    onError: (err) => setUserUiError(errorMessage(err)),
  });

  const resetUserPassword = useMutation({
    mutationFn: async (vars: { id: string; password: string }) =>
      api.patch(`/users/${vars.id}/reset-password`, { password: vars.password }),
    onSuccess: () => {
      setResetTarget(null);
      setResetPassword("");
      setUserUiError("");
    },
    onError: (err) => setUserUiError(errorMessage(err)),
  });

  const paymentError = useMemo(() => {
    if (!paymentQ.isError) return "";
    return errorMessage(paymentQ.error);
  }, [paymentQ.error, paymentQ.isError]);

  if (!canManageUsers) {
    return null;
  }

  if (q.isLoading) return <p className="text-sm text-muted">Loading users…</p>;
  if (q.isError) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-red-600">Could not load users</p>
        <p className="text-sm text-muted">{errorMessage(q.error)}</p>
        {q.error instanceof ApiError && q.error.status ? <p className="text-xs text-muted">HTTP {q.error.status}</p> : null}
      </div>
    );
  }

  const rows = Array.isArray(q.data) ? q.data : null;
  if (!rows) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-red-600">Unexpected response</p>
        <p className="text-sm text-muted">The server did not return a user list.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted">Admin & account head view</p>
        </div>
        {canManageUsers ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setCreateOpen(true);
              setUserName("");
              setUserEmail("");
              setUserRole("MEMBER");
              setUserPassword("");
              setUserUiError("");
            }}
          >
            Add user
          </button>
        ) : null}
      </div>
      {userUiError ? <p className="text-sm text-red-600">{userUiError}</p> : null}

      <div className="surface overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-panel-muted text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Blocked</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((u) => (
              <tr key={u.id} className="transition hover:bg-panel-muted">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-muted">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-line bg-panel px-2 py-0.5 text-xs">{u.role}</span>
                </td>
                <td className="px-4 py-3">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!u.isBlocked}
                      disabled={setBlocked.isPending}
                      onChange={(e) => setBlocked.mutate({ id: u.id, blocked: !e.target.checked })}
                    />
                    <span className="text-xs text-muted">{u.isBlocked ? "Inactive" : "Active"}</span>
                  </label>
                </td>
                <td className="px-4 py-3 text-xs text-muted">{formatDateTime(u.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button type="button" className="btn-secondary" onClick={() => setSelectedUser(u)}>
                      Payments
                    </button>
                    {canManageUsers ? (
                      <>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setEditingUser(u);
                            setUserName(u.name);
                            setUserEmail(u.email);
                            setUserRole(u.role);
                            setUserPassword("");
                            setUserUiError("");
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setResetTarget(u);
                            setResetPassword("");
                            setUserUiError("");
                          }}
                        >
                          Reset password
                        </button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <p className="px-4 py-10 text-center text-sm text-muted">No users yet.</p> : null}
      </div>

      {selectedUser ? (
        <div
          className="fixed inset-0 z-[120] flex justify-end bg-ink/30"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedUser(null);
          }}
        >
          <div className="h-dvh w-full max-w-2xl overflow-auto border-l border-line bg-panel">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-panel px-4 py-3">
              <div>
                <h3 className="text-base font-semibold">{selectedUser.name} payment history</h3>
                <p className="text-xs text-muted">{selectedUser.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary inline-flex items-center gap-1.5"
                  onClick={() => {
                    setAddingForRequirement({ id: "", itemName: "Member fund allocation" });
                    setAddAmount("");
                    setAddMethod("");
                    setAddNote("");
                    setAddPaidAt(new Date().toISOString().slice(0, 10));
                    setAddPaymentUiError("");
                  }}
                  title="Add payment"
                >
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
                    <path
                      fill="currentColor"
                      d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z"
                    />
                  </svg>
                  Add payment
                </button>
                <button type="button" className="btn-secondary" onClick={() => setSelectedUser(null)}>
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-3 px-4 py-4">
              {paymentQ.isLoading ? <p className="text-sm text-muted">Loading payment history…</p> : null}
              {paymentError ? <p className="text-sm text-red-600">{paymentError}</p> : null}

              {paymentQ.data?.summary ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-line bg-panel-muted p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">Total amount (given to member)</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">
                      {Number(paymentQ.data.summary.totalAmount).toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-panel-muted p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">
                      Paid amount (member paid vendor)
                    </p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">
                      {Number(paymentQ.data.summary.totalPaid).toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-panel-muted p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">Remaining amount</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">
                      {Number(paymentQ.data.summary.remainingAmount).toFixed(2)}
                    </p>
                  </div>
                </div>
              ) : null}
              {paymentQ.data?.summary ? (
                <p className="text-xs text-muted">
                  Total = member ko assigned amount, Paid = member se vendor payment, Remaining = abhi kitna balance bacha.
                </p>
              ) : null}
              {addPaymentUiError ? <p className="text-sm text-red-600">{addPaymentUiError}</p> : null}

              <div className="rounded-xl border border-line p-3">
                <p className="text-xs uppercase tracking-wide text-muted">User payment entries</p>
                <div className="mt-2 space-y-2">
                  {(paymentQ.data?.payments ?? []).map((p) => (
                    <div key={p.id} className="rounded-lg border border-line bg-panel-muted p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Paid amount: {Number(p.amount).toFixed(2)}</p>
                          <p className="text-xs text-muted">Paid date: {formatDateTime(p.paidAt)}</p>
                          <p className="text-xs text-muted">Method: {p.method?.trim() ? p.method : "-"}</p>
                          <p className="text-xs text-muted">Note: {p.note?.trim() ? p.note : "-"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="btn-secondary inline-flex items-center gap-1"
                            onClick={() => {
                              setEditingPayment(p);
                              setEditAmount(Number(p.amount).toFixed(2));
                              setEditMethod(p.method ?? "");
                              setEditNote(p.note ?? "");
                              setEditPaidAt(p.paidAt.slice(0, 10));
                            }}
                            title="Edit payment"
                          >
                            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
                              <path
                                fill="currentColor"
                                d="M14.69 2.86a2 2 0 0 1 2.83 2.83l-8.4 8.4a1 1 0 0 1-.46.26l-3.2.8a1 1 0 0 1-1.21-1.21l.8-3.2a1 1 0 0 1 .26-.46l8.4-8.4ZM13.28 4.27 6.16 11.39l-.42 1.66 1.66-.42 7.12-7.12-1.24-1.24Z"
                              />
                            </svg>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-secondary inline-flex items-center gap-1 text-red-600"
                            title="Delete payment"
                            disabled={deletePayment.isPending}
                            onClick={() => deletePayment.mutate(p.id)}
                          >
                            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
                              <path
                                fill="currentColor"
                                d="M7.5 2a1 1 0 0 0-.95.68L6.28 3.5H4a1 1 0 1 0 0 2h.54l.8 10.4A2 2 0 0 0 7.33 18h5.34a2 2 0 0 0 1.99-2.1l.8-10.4H16a1 1 0 1 0 0-2h-2.28l-.27-.82A1 1 0 0 0 12.5 2h-5ZM8.22 3.5h3.56l.17.5H8.05l.17-.5Zm.03 4.5a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Zm3.5 0a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Z"
                              />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!paymentQ.data?.payments?.length && !paymentQ.isLoading ? (
                <p className="text-sm text-muted">No payment history for this user.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {createOpen || editingUser ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-ink/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setCreateOpen(false);
              setEditingUser(null);
            }
          }}
        >
          <div className="surface w-full max-w-lg p-4">
            <h4 className="text-base font-semibold">{createOpen ? "Add user" : "Edit user"}</h4>
            <div className="mt-3 grid gap-3">
              <label className="label block">
                Name
                <input className="input-base mt-1 w-full" value={userName} onChange={(e) => setUserName(e.target.value)} />
              </label>
              <label className="label block">
                Email
                <input className="input-base mt-1 w-full" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} />
              </label>
              <label className="label block">
                Role
                <AppSelect
                  value={userRole}
                  onChange={setUserRole}
                  options={[
                    { value: "ADMIN", label: "ADMIN" },
                    { value: "ACCOUNT_HEAD", label: "ACCOUNT_HEAD" },
                    { value: "MEMBER", label: "MEMBER" },
                  ]}
                />
              </label>
              {createOpen ? (
                <label className="label block">
                  Password
                  <input
                    type="password"
                    className="input-base mt-1 w-full"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                  />
                </label>
              ) : null}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setCreateOpen(false);
                  setEditingUser(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={createUser.isPending || updateUser.isPending}
                onClick={() => {
                  if (!userName.trim() || !userEmail.trim()) {
                    setUserUiError("Name and email are required.");
                    return;
                  }
                  if (createOpen) {
                    if (userPassword.length < 8) {
                      setUserUiError("Password must be at least 8 characters.");
                      return;
                    }
                    createUser.mutate({
                      name: userName.trim(),
                      email: userEmail.trim(),
                      role: userRole,
                      password: userPassword,
                    });
                    return;
                  }
                  if (!editingUser) return;
                  updateUser.mutate({
                    id: editingUser.id,
                    name: userName.trim(),
                    email: userEmail.trim(),
                    role: userRole,
                  });
                }}
              >
                {createOpen ? "Create user" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {resetTarget ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-ink/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setResetTarget(null);
          }}
        >
          <div className="surface w-full max-w-lg p-4">
            <h4 className="text-base font-semibold">Reset password</h4>
            <p className="mt-1 text-xs text-muted">{resetTarget.email}</p>
            <label className="label mt-3 block">
              New password
              <input
                type="password"
                className="input-base mt-1 w-full"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
            </label>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setResetTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={resetUserPassword.isPending}
                onClick={() => {
                  if (resetPassword.length < 8) {
                    setUserUiError("Password must be at least 8 characters.");
                    return;
                  }
                  setUserUiError("");
                  resetUserPassword.mutate({ id: resetTarget.id, password: resetPassword });
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingPayment ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-ink/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditingPayment(null);
          }}
        >
          <div className="surface w-full max-w-lg p-4">
            <h4 className="text-base font-semibold">Update payment</h4>
            <p className="mt-1 text-xs text-muted">{editingPayment.requirement.itemName}</p>
            <div className="mt-3 grid gap-3">
              <label className="label block">
                Amount
                <input
                  className="input-base mt-1 w-full"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
              </label>
              <label className="label block">
                Paid date
                <input
                  className="input-base mt-1 w-full"
                  type="date"
                  value={editPaidAt}
                  onChange={(e) => setEditPaidAt(e.target.value)}
                />
              </label>
              <label className="label block">
                Date
                <input
                  className="input-base mt-1 w-full"
                  type="date"
                  value={addPaidAt}
                  onChange={(e) => setAddPaidAt(e.target.value)}
                />
              </label>
              <label className="label block">
                Method
                <input className="input-base mt-1 w-full" value={editMethod} onChange={(e) => setEditMethod(e.target.value)} />
              </label>
              <label className="label block">
                Note
                <textarea className="input-base mt-1 w-full" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setEditingPayment(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={updatePayment.isPending}
                onClick={() =>
                  updatePayment.mutate({
                    paymentId: editingPayment.id,
                    amount: Number(editAmount),
                    paidAt: new Date(editPaidAt).toISOString(),
                    method: editMethod,
                    note: editNote,
                  })
                }
              >
                Save update
              </button>
            </div>
            {updatePayment.isError ? <p className="mt-2 text-sm text-red-600">{errorMessage(updatePayment.error)}</p> : null}
          </div>
        </div>
      ) : null}

      {addingForRequirement ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-ink/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAddingForRequirement(null);
          }}
        >
          <div className="surface w-full max-w-lg p-4">
            <h4 className="text-base font-semibold">Add payment</h4>
            <p className="mt-1 text-xs text-muted">
              This adds amount to member balance. Vendor payment depends on member usage.
            </p>
            <div className="mt-3 grid gap-3">
              <label className="label block">
                Amount
                <input
                  className="input-base mt-1 w-full"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                />
              </label>
              <label className="label block">
                Method
                <input className="input-base mt-1 w-full" value={addMethod} onChange={(e) => setAddMethod(e.target.value)} />
              </label>
              <label className="label block">
                Note
                <textarea className="input-base mt-1 w-full" value={addNote} onChange={(e) => setAddNote(e.target.value)} />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setAddingForRequirement(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={addPayment.isPending}
                onClick={() => {
                  const amount = Number(addAmount);
                  if (!Number.isFinite(amount) || amount <= 0) {
                    setAddPaymentUiError("Enter a valid amount greater than 0.");
                    return;
                  }
                  setAddPaymentUiError("");
                  addPayment.mutate({
                    amount,
                    paidAt: addPaidAt ? new Date(addPaidAt).toISOString() : undefined,
                    method: addMethod,
                    note: addNote,
                  });
                }}
              >
                Save payment
              </button>
            </div>
            {addPayment.isError ? <p className="mt-2 text-sm text-red-600">{errorMessage(addPayment.error)}</p> : null}
            {deletePayment.isError ? <p className="mt-2 text-sm text-red-600">{errorMessage(deletePayment.error)}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(d);
}

