import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  FolderKanban,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Tags,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  createContactGroup,
  createContactTag,
  deleteContactGroup,
  deleteContactTag,
  fetchContact,
  fetchContactGroups,
  fetchContactTags,
  patchContact,
  renameContactGroup,
  renameContactTag,
  setContactGroups,
  setContactTags,
} from "@/lib/contacts-api";
import {
  formatContactDate,
  getCompany,
  getContactName,
  getInitials,
  getLocation,
  getPrimaryEmail,
  getPrimaryPhone,
  getTitle,
} from "@/lib/contact-display";
import { friendlyErrorMessages, logUiError } from "@/lib/friendly-errors";
import type { ContactDetail, ContactGroup, ContactLabel } from "@/lib/types";
import { cn } from "@/lib/utils";

function ContactAvatar({ contact }: { contact: ContactDetail }) {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary text-lg font-semibold text-secondary-foreground">
      {getInitials(contact)}
    </div>
  );
}

function DetailTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-surface p-4">
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 break-words text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

function ListSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children?: ReactNode;
}) {
  const hasContent = children != null && children !== false;

  return (
    <Panel className="p-5 md:p-6">
      <PanelHeader title={title} className="mb-3" />
      {hasContent ? (
        children
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </Panel>
  );
}

function AssignmentColumn({
  title,
  icon: Icon,
  empty,
  children,
  addSlot,
}: {
  title: string;
  icon: LucideIcon;
  empty: string;
  children?: ReactNode;
  addSlot: ReactNode;
}) {
  const hasItems = children != null && children !== false;

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-background p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>

      <div className="min-h-0 flex-1">
        {hasItems ? (
          <div className="grid gap-1">{children}</div>
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </div>

      <div className="mt-4 border-t border-border pt-4">{addSlot}</div>
    </div>
  );
}

function AssignmentRow({
  checked,
  onChange,
  label,
  meta,
  onRename,
  onDelete,
  isRenaming,
  renameValue,
  onRenameValueChange,
  onRenameSubmit,
  onRenameCancel,
  isMutating,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  meta?: ReactNode;
  onRename?: () => void;
  onDelete?: () => void;
  isRenaming?: boolean;
  renameValue?: string;
  onRenameValueChange?: (value: string) => void;
  onRenameSubmit?: () => void;
  onRenameCancel?: () => void;
  isMutating?: boolean;
}) {
  if (isRenaming) {
    return (
      <div className="flex items-center gap-2 rounded-md px-2.5 py-2">
        <Input
          value={renameValue ?? ""}
          onChange={(event) => onRenameValueChange?.(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onRenameSubmit?.();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onRenameCancel?.();
            }
          }}
          disabled={isMutating}
          aria-label="Rename label"
        />
        <Button
          type="button"
          size="sm"
          disabled={isMutating || !renameValue?.trim()}
          onClick={() => onRenameSubmit?.()}
        >
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isMutating}
          onClick={() => onRenameCancel?.()}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm transition-colors duration-150 hover:bg-bg-hover">
      <span className="flex min-w-0 items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={isMutating}
          className="h-4 w-4 accent-foreground"
        />
        <span className="truncate text-foreground">{label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {meta}
        {onRename ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={isMutating}
            onClick={(event) => {
              event.preventDefault();
              onRename();
            }}
            aria-label={`Rename ${label}`}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : null}
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            disabled={isMutating}
            onClick={(event) => {
              event.preventDefault();
              onDelete();
            }}
            aria-label={`Delete ${label}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </span>
    </label>
  );
}

function labelIds(labels: ContactLabel[]) {
  return labels.map((label) => label.id);
}

function sameIdSet(current: string[], next: string[]) {
  if (current.length !== next.length) {
    return false;
  }
  const currentSet = new Set(current);
  return next.every((id) => currentSet.has(id));
}

function toggleId(ids: string[], id: string) {
  return ids.includes(id)
    ? ids.filter((currentId) => currentId !== id)
    : [...ids, id];
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids));
}

export default function ContactDetailPage() {
  const { contactId } = useParams();
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [availableTags, setAvailableTags] = useState<ContactLabel[]>([]);
  const [availableGroups, setAvailableGroups] = useState<ContactGroup[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [editingLabel, setEditingLabel] = useState<{
    kind: "tag" | "group";
    id: string;
  } | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [mutatingLabelId, setMutatingLabelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasAssignmentChanges = useMemo(() => {
    if (!contact) {
      return false;
    }
    return (
      !sameIdSet(labelIds(contact.tags), selectedTagIds) ||
      !sameIdSet(labelIds(contact.groups), selectedGroupIds)
    );
  }, [contact, selectedGroupIds, selectedTagIds]);

  useEffect(() => {
    let isMounted = true;

    const loadContact = async () => {
      if (!contactId) {
        setError("Contact id is missing.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const [data, tagData, groupData] = await Promise.all([
          fetchContact(contactId),
          fetchContactTags(),
          fetchContactGroups(),
        ]);
        if (isMounted) {
          setContact(data);
          setAvailableTags(tagData);
          setAvailableGroups(groupData);
          setSelectedTagIds(labelIds(data.tags));
          setSelectedGroupIds(labelIds(data.groups));
          setNotesDraft(data.notes ?? "");
        }
      } catch (err) {
        if (isMounted) {
          logUiError("Could not load contact", err);
          setContact(null);
          setError(friendlyErrorMessages.load);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadContact();
    return () => {
      isMounted = false;
    };
  }, [contactId]);

  const saveAssignments = async () => {
    if (!contact || !hasAssignmentChanges) {
      return;
    }

    setIsSavingAssignments(true);
    try {
      let updatedContact = contact;
      if (!sameIdSet(labelIds(contact.tags), selectedTagIds)) {
        updatedContact = await setContactTags(contact.id, selectedTagIds);
      }
      if (!sameIdSet(labelIds(updatedContact.groups), selectedGroupIds)) {
        updatedContact = await setContactGroups(contact.id, selectedGroupIds);
      }
      setContact(updatedContact);
      setSelectedTagIds(labelIds(updatedContact.tags));
      setSelectedGroupIds(labelIds(updatedContact.groups));
      toast.success("Contact assignments updated.");
    } catch (err) {
      logUiError("Could not update contact assignments", err);
      toast.error("We couldn't update this contact right now.");
    } finally {
      setIsSavingAssignments(false);
    }
  };

  const createAndAssignTag = async () => {
    if (!contact) {
      return;
    }

    const name = newTagName.trim();
    if (!name) {
      return;
    }

    setIsCreatingTag(true);
    try {
      const tag = await createContactTag(name);
      const nextTagIds = uniqueIds([...selectedTagIds, tag.id]);
      const updatedContact = await setContactTags(contact.id, nextTagIds);
      setAvailableTags((current) =>
        current.some((currentTag) => currentTag.id === tag.id)
          ? current
          : [...current, tag].sort((first, second) =>
              first.name.localeCompare(second.name, undefined, {
                sensitivity: "base",
              }),
            ),
      );
      setContact(updatedContact);
      setSelectedTagIds(labelIds(updatedContact.tags));
      setNewTagName("");
      toast.success("Tag created and added to this contact.");
    } catch (err) {
      logUiError("Could not create contact tag", err);
      toast.error("We couldn't create that tag right now.");
    } finally {
      setIsCreatingTag(false);
    }
  };

  const createAndAssignGroup = async () => {
    if (!contact) {
      return;
    }

    const name = newGroupName.trim();
    if (!name) {
      return;
    }

    setIsCreatingGroup(true);
    try {
      const group = await createContactGroup(name);
      const nextGroupIds = uniqueIds([...selectedGroupIds, group.id]);
      const updatedContact = await setContactGroups(contact.id, nextGroupIds);
      setAvailableGroups((current) =>
        current.some((currentGroup) => currentGroup.id === group.id)
          ? current
          : [...current, group].sort((first, second) =>
              first.name.localeCompare(second.name, undefined, {
                sensitivity: "base",
              }),
            ),
      );
      setContact(updatedContact);
      setSelectedGroupIds(labelIds(updatedContact.groups));
      setNewGroupName("");
      toast.success("Group created with this contact.");
    } catch (err) {
      logUiError("Could not create contact group", err);
      toast.error("We couldn't create that group right now.");
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const saveNotes = async () => {
    if (!contact) {
      return;
    }

    const trimmedNotes = notesDraft.trim();
    const nextNotes = trimmedNotes || null;
    if ((contact.notes ?? null) === nextNotes) {
      return;
    }

    setIsSavingNotes(true);
    try {
      const updatedContact = await patchContact(contact.id, { notes: nextNotes });
      setContact(updatedContact);
      setNotesDraft(updatedContact.notes ?? "");
      toast.success("Notes saved.");
    } catch (err) {
      logUiError("Could not save contact notes", err);
      toast.error("We couldn't save notes right now.");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const startRenameLabel = (kind: "tag" | "group", id: string, name: string) => {
    setEditingLabel({ kind, id });
    setRenameDraft(name);
  };

  const cancelRenameLabel = () => {
    setEditingLabel(null);
    setRenameDraft("");
  };

  const submitRenameLabel = async () => {
    if (!editingLabel) {
      return;
    }

    const name = renameDraft.trim();
    if (!name) {
      return;
    }

    setMutatingLabelId(editingLabel.id);
    try {
      if (editingLabel.kind === "tag") {
        const updatedTag = await renameContactTag(editingLabel.id, name);
        setAvailableTags((current) =>
          current
            .map((tag) => (tag.id === updatedTag.id ? updatedTag : tag))
            .sort((first, second) =>
              first.name.localeCompare(second.name, undefined, {
                sensitivity: "base",
              }),
            ),
        );
      } else {
        const updatedGroup = await renameContactGroup(editingLabel.id, name);
        setAvailableGroups((current) =>
          current
            .map((group) => (group.id === updatedGroup.id ? updatedGroup : group))
            .sort((first, second) =>
              first.name.localeCompare(second.name, undefined, {
                sensitivity: "base",
              }),
            ),
        );
      }
      toast.success("Label renamed.");
      cancelRenameLabel();
    } catch (err) {
      logUiError("Could not rename contact label", err);
      toast.error("We couldn't rename that label right now.");
    } finally {
      setMutatingLabelId(null);
    }
  };

  const deleteLabel = async (kind: "tag" | "group", id: string) => {
    setMutatingLabelId(id);
    try {
      if (kind === "tag") {
        await deleteContactTag(id);
        setAvailableTags((current) => current.filter((tag) => tag.id !== id));
        setSelectedTagIds((current) => current.filter((tagId) => tagId !== id));
        if (contact) {
          setContact({
            ...contact,
            tags: contact.tags.filter((tag) => tag.id !== id),
          });
        }
      } else {
        await deleteContactGroup(id);
        setAvailableGroups((current) => current.filter((group) => group.id !== id));
        setSelectedGroupIds((current) =>
          current.filter((groupId) => groupId !== id),
        );
        if (contact) {
          setContact({
            ...contact,
            groups: contact.groups.filter((group) => group.id !== id),
          });
        }
      }
      toast.success("Label deleted.");
    } catch (err) {
      logUiError("Could not delete contact label", err);
      toast.error("We couldn't delete that label right now.");
    } finally {
      setMutatingLabelId(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/dashboard/contacts"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Contacts
          </Link>
        </div>

        {error ? (
          <Alert className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-4 w-4 text-destructive"
              aria-hidden="true"
            />
            <div>
              <p className="font-medium">Could not load contact</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {friendlyErrorMessages.load}
              </p>
            </div>
          </Alert>
        ) : null}

        {isLoading ? (
          <Panel className="space-y-4">
            <Skeleton className="h-14 w-14 rounded-full" />
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </Panel>
        ) : null}

        {!isLoading && !error && contact ? (
          <>
            <Panel className="p-5 md:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <ContactAvatar contact={contact} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-xl font-semibold tracking-[-0.01em] text-foreground">
                        {getContactName(contact)}
                      </h1>
                      <StatusBadge variant="neutral">
                        {contact.source.toLowerCase()}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {getCompany(contact) || getTitle(contact) || "Contact"}
                    </p>
                  </div>
                </div>
                <div className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2 lg:text-right">
                  <p>Created {formatContactDate(contact.createdAt)}</p>
                  <p>Updated {formatContactDate(contact.updatedAt)}</p>
                </div>
              </div>
            </Panel>

            <section className="grid gap-4 md:grid-cols-3">
              <DetailTile
                icon={Mail}
                label="Primary email"
                value={getPrimaryEmail(contact) || "No email"}
              />
              <DetailTile
                icon={Phone}
                label="Primary phone"
                value={getPrimaryPhone(contact) || "No phone"}
              />
              <DetailTile
                icon={MapPin}
                label="Location"
                value={getLocation(contact) || "No location"}
              />
            </section>

            <Panel className="p-5 md:p-6">
              <PanelHeader title="Tags & groups" className="mb-4" />

              <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
                <AssignmentColumn
                  title="Tags"
                  icon={Tags}
                  empty="No tags yet"
                  addSlot={
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        value={newTagName}
                        onChange={(event) => setNewTagName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void createAndAssignTag();
                          }
                        }}
                        placeholder="Add new tag"
                        disabled={isCreatingTag}
                        aria-label="New tag name"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={!newTagName.trim() || isCreatingTag}
                        onClick={() => void createAndAssignTag()}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        {isCreatingTag ? "Adding" : "Add"}
                      </Button>
                    </div>
                  }
                >
                  {availableTags.length > 0
                    ? availableTags.map((tag) => (
                        <AssignmentRow
                          key={tag.id}
                          checked={selectedTagIds.includes(tag.id)}
                          onChange={() =>
                            setSelectedTagIds((current) =>
                              toggleId(current, tag.id),
                            )
                          }
                          label={tag.name}
                          isMutating={mutatingLabelId === tag.id}
                          isRenaming={
                            editingLabel?.kind === "tag" &&
                            editingLabel.id === tag.id
                          }
                          renameValue={renameDraft}
                          onRenameValueChange={setRenameDraft}
                          onRenameSubmit={() => void submitRenameLabel()}
                          onRenameCancel={cancelRenameLabel}
                          onRename={() => startRenameLabel("tag", tag.id, tag.name)}
                          onDelete={() => void deleteLabel("tag", tag.id)}
                        />
                      ))
                    : null}
                </AssignmentColumn>

                <AssignmentColumn
                  title="Groups"
                  icon={FolderKanban}
                  empty="No groups yet"
                  addSlot={
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        value={newGroupName}
                        onChange={(event) =>
                          setNewGroupName(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void createAndAssignGroup();
                          }
                        }}
                        placeholder="Add new group"
                        disabled={isCreatingGroup}
                        aria-label="New group name"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={
                          !newGroupName.trim() ||
                          isCreatingGroup
                        }
                        onClick={() => void createAndAssignGroup()}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        {isCreatingGroup ? "Adding" : "Add"}
                      </Button>
                    </div>
                  }
                >
                  {availableGroups.length > 0
                    ? availableGroups.map((group) => (
                        <AssignmentRow
                          key={group.id}
                          checked={selectedGroupIds.includes(group.id)}
                          onChange={() =>
                            setSelectedGroupIds((current) =>
                              toggleId(current, group.id),
                            )
                          }
                          label={group.name}
                          meta={
                            group.source ? (
                              <StatusBadge variant="neutral">
                                {group.source.toLowerCase()}
                              </StatusBadge>
                            ) : null
                          }
                          isMutating={mutatingLabelId === group.id}
                          isRenaming={
                            editingLabel?.kind === "group" &&
                            editingLabel.id === group.id
                          }
                          renameValue={renameDraft}
                          onRenameValueChange={setRenameDraft}
                          onRenameSubmit={() => void submitRenameLabel()}
                          onRenameCancel={cancelRenameLabel}
                          onRename={() =>
                            startRenameLabel("group", group.id, group.name)
                          }
                          onDelete={() => void deleteLabel("group", group.id)}
                        />
                      ))
                    : null}
                </AssignmentColumn>
              </div>

              <div className="mt-5 flex justify-end border-t border-border pt-4">
                <Button
                  type="button"
                  disabled={!hasAssignmentChanges || isSavingAssignments}
                  onClick={() => void saveAssignments()}
                >
                  {isSavingAssignments ? "Saving" : "Save assignments"}
                </Button>
              </div>
            </Panel>

            <section className="grid gap-4 xl:grid-cols-2">
              <ListSection title="Phones" empty="No phone numbers">
                {contact.phones.length > 0 ? (
                  <div className="grid gap-2">
                    {contact.phones.map((phone) => (
                      <div
                        key={`${phone.value}-${phone.label ?? "phone"}`}
                        className="rounded-lg border border-border bg-background p-3"
                      >
                        <p className="font-medium text-foreground">
                          {phone.value}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {phone.label ?? "Phone"}
                          {phone.isPrimary ? " · Primary" : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </ListSection>

              <ListSection title="Emails" empty="No email addresses">
                {contact.emails.length > 0 ? (
                  <div className="grid gap-2">
                    {contact.emails.map((email) => (
                      <div
                        key={`${email.value}-${email.label ?? "email"}`}
                        className="rounded-lg border border-border bg-background p-3"
                      >
                        <p className="font-medium text-foreground">
                          {email.value}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {email.label ?? "Email"}
                          {email.isPrimary ? " · Primary" : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </ListSection>

              <ListSection title="Organizations" empty="No organizations">
                {contact.organizations.length > 0 ? (
                  <div className="grid gap-2">
                    {contact.organizations.map((organization, index) => (
                      <div
                        key={`${organization.companyName ?? "organization"}-${index}`}
                        className="rounded-lg border border-border bg-background p-3"
                      >
                        <div className="flex items-start gap-3">
                          <Building2
                            className="mt-0.5 h-4 w-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <div>
                            <p className="font-medium text-foreground">
                              {organization.companyName ?? "Organization"}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {[organization.title, organization.department]
                                .filter(Boolean)
                                .join(" · ") || "No role details"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </ListSection>

              <ListSection title="Addresses" empty="No addresses">
                {contact.addresses.length > 0 ? (
                  <div className="grid gap-2">
                    {contact.addresses.map((address, index) => (
                      <div
                        key={`${address.street ?? "address"}-${index}`}
                        className="rounded-lg border border-border bg-background p-3"
                      >
                        <p className="font-medium text-foreground">
                          {[address.street, address.city, address.region]
                            .filter(Boolean)
                            .join(", ") || "Address"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {[address.postalCode, address.country]
                            .filter(Boolean)
                            .join(", ") || "No location details"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </ListSection>
            </section>

            <ListSection title="URLs" empty="No URLs">
              {contact.urls.length > 0 ? (
                <div className="grid gap-2">
                  {contact.urls.map((url) => (
                    <div
                      key={url.value}
                      className="flex items-start gap-3 rounded-lg border border-border bg-background p-3"
                    >
                      <Globe
                        className="mt-0.5 h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <a
                          href={url.value}
                          target="_blank"
                          rel="noreferrer"
                          className="break-words font-medium text-foreground hover:underline"
                        >
                          {url.value}
                        </a>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {url.label ?? "URL"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </ListSection>

            <Panel className="p-5 md:p-6">
              <PanelHeader title="Notes" className="mb-3" />
              <textarea
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                rows={4}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                placeholder="Add notes about this contact"
                aria-label="Contact notes"
              />
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    isSavingNotes ||
                    (contact.notes ?? "") === notesDraft.trim()
                  }
                  onClick={() => void saveNotes()}
                >
                  {isSavingNotes ? "Saving" : "Save notes"}
                </Button>
              </div>
            </Panel>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
