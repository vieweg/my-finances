import { useState, useEffect } from "react";
import { Plus, Pencil, RotateCcw, Trash2, Users, Mail, Phone, FileText, Search, ChevronUp, ChevronDown, X } from "lucide-react";
import {
  useContacts,
  useDeleteContact,
  useRestoreContact,
  useHardDeleteContact,
  ContactFormDialog,
} from "@/features/contacts";
import type { ContactFilters } from "@/features/contacts";
import type { components } from "@/api/generated";

type Contact = components["schemas"]["Contact"];
type SortField = NonNullable<ContactFilters["sortBy"]>;

type DialogState =
  | { type: "create" }
  | { type: "edit"; contact: Contact }
  | null;

const SORT_OPTIONS: { label: string; value: SortField }[] = [
  { label: "Name", value: "name" },
  { label: "Email", value: "email" },
  { label: "Created", value: "createdAt" },
  { label: "Updated", value: "updatedAt" },
];

export default function ContactsPage() {
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);

  const [nameInput, setNameInput] = useState("");
  const [filters, setFilters] = useState<ContactFilters>({
    sortBy: "name",
    sortOrder: "asc",
  });

  useEffect(() => {
    const t = setTimeout(
      () => setFilters((f) => ({ ...f, name: nameInput || undefined })),
      300,
    );
    return () => clearTimeout(t);
  }, [nameInput]);

  const activeFilters = { ...filters, deleted: showDeleted || undefined };
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useContacts(activeFilters);

  const contacts = data?.pages.flatMap((p) => p.data ?? []) ?? [];
  const total = data?.pages[0]?.pagination?.total;

  const deleteContact = useDeleteContact();
  const restoreContact = useRestoreContact();
  const hardDeleteContact = useHardDeleteContact();

  function toggleSort(field: SortField) {
    setFilters((f) => ({
      ...f,
      sortBy: field,
      sortOrder: f.sortBy === field && f.sortOrder === "asc" ? "desc" : "asc",
    }));
  }

  function clearSearch() {
    setNameInput("");
    setFilters((f) => ({ ...f, name: undefined }));
  }

  async function handleDelete(contact: Contact) {
    if (!confirm(`Delete "${contact.name}"?`)) return;
    await deleteContact.mutateAsync(contact.id!);
  }

  async function handleRestore(contact: Contact) {
    await restoreContact.mutateAsync(contact.id!);
  }

  async function handleHardDelete(contact: Contact) {
    if (
      !confirm(
        `Permanently delete "${contact.name}"?\n\nThis action is irreversible and cannot be undone.`,
      )
    )
      return;
    await hardDeleteContact.mutateAsync(contact.id!);
  }

  const hasSearch = !!nameInput;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Contacts</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDeleted((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors ${
              showDeleted
                ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            {showDeleted ? <RotateCcw size={14} /> : <Trash2 size={14} />}
            <span className="hidden sm:inline">{showDeleted ? "Active" : "Deleted"}</span>
          </button>
          {!showDeleted && (
            <button
              onClick={() => setDialog({ type: "create" })}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">New Contact</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name..."
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          {hasSearch && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {SORT_OPTIONS.map(({ label, value }) => {
            const isActive = (filters.sortBy ?? "name") === value;
            return (
              <button
                key={value}
                onClick={() => toggleSort(value)}
                className={`flex items-center gap-0.5 px-2.5 py-2 text-xs rounded-md border transition-colors ${
                  isActive
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                <span className="hidden sm:inline">{label}</span>
                {isActive && (
                  filters.sortOrder === "asc"
                    ? <ChevronUp size={12} />
                    : <ChevronDown size={12} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading && (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse bg-gray-50" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">
          Error loading contacts: {error.message}
        </p>
      )}

      {!isLoading && contacts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-gray-200 text-center">
          <Users size={40} className="text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">
            {showDeleted
              ? "No deleted contacts."
              : hasSearch
                ? "No contacts match your search."
                : "No contacts yet."}
          </p>
          {!showDeleted && !hasSearch && (
            <button
              onClick={() => setDialog({ type: "create" })}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              Create your first contact
            </button>
          )}
        </div>
      )}

      {contacts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {contacts.map((contact) => (
            <div key={contact.id} className="flex items-start gap-3 px-4 py-4 group hover:bg-gray-50 transition-colors">
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-medium text-gray-900">
                  {contact.name}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {contact.email && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <Mail size={11} />
                      {contact.email}
                    </span>
                  )}
                  {contact.phone && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <Phone size={11} />
                      {contact.phone}
                    </span>
                  )}
                  {contact.document && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <FileText size={11} />
                      {contact.document}
                    </span>
                  )}
                </div>
                {contact.notes && (
                  <p className="text-xs text-gray-400 truncate">
                    {contact.notes}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                {showDeleted ? (
                  <>
                    <button
                      onClick={() => handleRestore(contact)}
                      disabled={restoreContact.isPending}
                      className="p-1.5 rounded text-gray-400 hover:text-green-600 hover:bg-green-50 disabled:opacity-40 transition-colors"
                      title="Restore contact"
                    >
                      <RotateCcw size={14} />
                    </button>
                    <button
                      onClick={() => handleHardDelete(contact)}
                      disabled={hardDeleteContact.isPending}
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                      title="Permanently delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setDialog({ type: "edit", contact })}
                      className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(contact)}
                      disabled={deleteContact.isPending}
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className="flex justify-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {isFetchingNextPage ? "Loading..." : `Load more${total != null ? ` (${contacts.length} of ${total})` : ""}`}
          </button>
        </div>
      )}

      {dialog?.type === "create" && (
        <ContactFormDialog onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "edit" && (
        <ContactFormDialog
          contact={dialog.contact}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
