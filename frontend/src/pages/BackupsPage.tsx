import { useState } from "react";
import { HardDrive, RotateCcw } from "lucide-react";
import { useBackups, useRestoreBackup } from "@/features/backups";
import type { components } from "@/api/generated";

type BackupFile = components["schemas"]["BackupFile"];

function BackupRow({ backup, onRestore }: { backup: BackupFile; onRestore: (filename: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  // Only full backups can be restored; incremental files are rejected by the backend
  const canRestore = backup.type === "full";

  async function handleRestore() {
    if (!confirm(`Restore backup "${backup.filename}"?\n\nAll your current data (wallets, tags, contacts, contracts, invoices and transactions) will be replaced by the state of this backup. Changes made after it was generated will be lost.`)) return;
    setBusy(true);
    try {
      await onRestore(backup.filename!);
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3 text-sm font-mono text-gray-800">{backup.filename}</td>
      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{backup.generatedAt}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            backup.type === "full"
              ? "bg-blue-50 text-blue-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {backup.type}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{backup.since ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-gray-600 text-right">{backup.sizeKb != null ? `${backup.sizeKb} KB` : "—"}</td>
      <td className="px-4 py-3 text-sm text-gray-600 text-right">{backup.rows ?? "—"}</td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={handleRestore}
          disabled={busy || !canRestore}
          title={canRestore ? undefined : "Only full backups can be restored"}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-40 transition-colors"
        >
          <RotateCcw size={13} />
          {busy ? "Restoring..." : "Restore"}
        </button>
      </td>
    </tr>
  );
}

export default function BackupsPage() {
  const { data: backups, isLoading, error } = useBackups();
  const restoreBackup = useRestoreBackup();
  const [restoreResult, setRestoreResult] = useState<{ filename: string; appliedStatements: number } | null>(null);

  async function handleRestore(filename: string) {
    const result = await restoreBackup.mutateAsync(filename);
    setRestoreResult({
      filename: result.filename ?? filename,
      appliedStatements: result.appliedStatements ?? 0,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Backups</h1>
      </div>

      {restoreResult && (
        <div className="flex items-start justify-between gap-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          <span>
            Restored <span className="font-mono font-medium">{restoreResult.filename}</span> — {restoreResult.appliedStatements} statements applied.
          </span>
          <button onClick={() => setRestoreResult(null)} className="text-green-600 hover:text-green-800 shrink-0">
            ✕
          </button>
        </div>
      )}

      {restoreBackup.error && (
        <p className="text-sm text-red-600">{restoreBackup.error.message}</p>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading && (
          <div className="space-y-2 p-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 px-4 py-4">{error.message}</p>
        )}

        {!isLoading && !error && backups?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <HardDrive size={40} className="text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No backups found.</p>
          </div>
        )}

        {!isLoading && backups && backups.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Filename</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Generated</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Since</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Size</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Rows</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <BackupRow
                    key={backup.filename}
                    backup={backup}
                    onRestore={handleRestore}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
