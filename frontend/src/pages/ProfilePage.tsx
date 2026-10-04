import { useState, useEffect } from "react";
import { RotateCcw, HardDrive } from "lucide-react";
import { useCurrentUser, useUpdateUser, useLogoutAllSessions } from "@/features/auth";
import { useBackups, useRestoreBackup } from "@/features/backups";
import type { components } from "@/api/generated";

type BackupFile = components["schemas"]["BackupFile"];

function BackupRow({ backup, onRestore }: { backup: BackupFile; onRestore: (f: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);

  async function handleRestore() {
    if (!confirm(`Restore backup "${backup.filename}"?\n\nThis will replay all SQL statements from this backup against the live database.`)) return;
    setBusy(true);
    try { await onRestore(backup.filename!); } finally { setBusy(false); }
  }

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3 text-xs font-mono text-gray-700 break-all">{backup.filename}</td>
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{backup.generatedAt}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${backup.type === "full" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}`}>
          {backup.type}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{backup.sizeKb != null ? `${backup.sizeKb} KB` : "—"}</td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={handleRestore}
          disabled={busy}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-40 transition-colors"
        >
          <RotateCcw size={11} />
          {busy ? "Restoring..." : "Restore"}
        </button>
      </td>
    </tr>
  );
}

export default function ProfilePage() {
  const { data: user, isLoading, error } = useCurrentUser();
  const updateUser = useUpdateUser(user?.id ?? "");
  const logoutAll = useLogoutAllSessions();
  const { data: backups, isLoading: backupsLoading } = useBackups();
  const restoreBackup = useRestoreBackup();
  const [restoreResult, setRestoreResult] = useState<{ filename: string; appliedStatements: number } | null>(null);

  async function handleRestore(filename: string) {
    const result = await restoreBackup.mutateAsync(filename);
    setRestoreResult({ filename: result.filename ?? filename, appliedStatements: result.appliedStatements ?? 0 });
  }

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setUsername(user.username ?? "");
    }
  }, [user]);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileSuccess(false);
    await updateUser.mutateAsync({ name, username });
    setProfileSuccess(true);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordSuccess(false);
    await updateUser.mutateAsync({ password: currentPassword, newPassword, confirmPassword });
    setPasswordSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-lg">
        <div className="h-8 w-32 rounded bg-gray-200 animate-pulse" />
        <div className="h-48 rounded-lg bg-gray-200 animate-pulse" />
        <div className="h-48 rounded-lg bg-gray-200 animate-pulse" />
      </div>
    );
  }

  if (error || !user) {
    return <p className="text-sm text-red-600">{error?.message ?? "Error loading profile."}</p>;
  }

  const profileDirty =
    name !== (user.name ?? "") ||
    username !== (user.username ?? "");

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-xl font-semibold text-gray-900">Profile</h1>

      {/* Profile info */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-4">Personal information</h2>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setProfileSuccess(false); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setProfileSuccess(false); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={user.email ?? ""}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-500 cursor-default"
            />
          </div>


          {updateUser.error && !passwordSuccess && (
            <p className="text-sm text-red-600">{updateUser.error.message}</p>
          )}
          {profileSuccess && (
            <p className="text-sm text-green-600">Profile updated successfully.</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={updateUser.isPending || !profileDirty}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {updateUser.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-4">Change password</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setPasswordSuccess(false); }}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setPasswordSuccess(false); }}
              required
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPasswordSuccess(false); }}
              required
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {updateUser.error && !profileSuccess && (
            <p className="text-sm text-red-600">{updateUser.error.message}</p>
          )}
          {passwordSuccess && (
            <p className="text-sm text-green-600">Password changed successfully.</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={updateUser.isPending || !currentPassword || !newPassword || !confirmPassword}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {updateUser.isPending ? "Saving..." : "Change password"}
            </button>
          </div>
        </form>
      </div>
      {/* Backups */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-4">Backups</h2>

        {restoreResult && (
          <div className="flex items-start justify-between gap-4 mb-4 px-3 py-2 bg-green-50 border border-green-200 rounded-md text-xs text-green-800">
            <span>
              Restored <span className="font-mono font-medium">{restoreResult.filename}</span> — {restoreResult.appliedStatements} statements applied.
            </span>
            <button onClick={() => setRestoreResult(null)} className="text-green-600 hover:text-green-800 shrink-0">✕</button>
          </div>
        )}

        {restoreBackup.error && (
          <p className="mb-4 text-xs text-red-600">{restoreBackup.error.message}</p>
        )}

        {backupsLoading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        )}

        {!backupsLoading && backups?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <HardDrive size={32} className="text-gray-300 mb-2" />
            <p className="text-xs text-gray-400">No backups found.</p>
          </div>
        )}

        {!backupsLoading && backups && backups.length > 0 && (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-y border-gray-100">
                  <th className="px-4 py-2 text-xs font-medium text-gray-500">Filename</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500">Generated</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500">Type</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-500">Size</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <BackupRow key={backup.filename} backup={backup} onRestore={handleRestore} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sessions */}
      <div className="bg-white rounded-lg border border-red-100 p-5">
        <h2 className="text-sm font-medium text-gray-700 mb-1">Sessions</h2>
        <p className="text-sm text-gray-500 mb-4">
          Sign out from all devices, including this one.
        </p>
        <button
          onClick={() => {
            if (!confirm("Sign out of all devices? You will be redirected to the login page.")) return;
            logoutAll.mutate();
          }}
          disabled={logoutAll.isPending}
          className="px-4 py-2 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          {logoutAll.isPending ? "Signing out..." : "Sign out of all devices"}
        </button>
        {logoutAll.error && (
          <p className="mt-2 text-sm text-red-600">{logoutAll.error.message}</p>
        )}
      </div>
    </div>
  );
}
