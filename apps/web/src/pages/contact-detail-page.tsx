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
  Phone,
  Plus,
  Tags,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { SampleDataNotice } from "@/components/sample-data-notice";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiFetch } from "@/lib/api";
import {
  createContactGroup,
  createContactTag,
  fetchContactGroups,
  fetchContactTags,
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
import { mockContactDetail } from "@/lib/mock-data";
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
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  meta?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm transition-colors duration-150 hover:bg-bg-hover">
      <span className="flex min-w-0 items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="h-4 w-4 accent-foreground"
        />
        <span className="truncate text-foreground">{label}</span>
      </span>
      {meta}
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
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(false);

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
          apiFetch<ContactDetail>(`/v1/contacts/${contactId}`),
          fetchContactTags(),
          fetchContactGroups(),
        ]);
        if (isMounted) {
          setContact(data);
          setAvailableTags(tagData);
          setAvailableGroups(groupData);
          setSelectedTagIds(labelIds(data.tags));
          setSelectedGroupIds(labelIds(data.groups));
          setIsMockData(false);
        }
      } catch (err) {
        if (isMounted) {
          logUiError("Could not load contact", err);
          const mockContact = mockContactDetail(contactId);
          setContact(mockContact);
          setAvailableTags(mockContact.tags);
          setAvailableGroups(mockContact.groups);
          setSelectedTagIds(labelIds(mockContact.tags));
          setSelectedGroupIds(labelIds(mockContact.groups));
          setIsMockData(true);
          setError(null);
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
    if (!contact || isMockData) {
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
    if (!contact || isMockData) {
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

        {isMockData ? <SampleDataNotice /> : null}

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
                        disabled={isCreatingTag || isMockData}
                        aria-label="New tag name"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={
                          !newTagName.trim() || isCreatingTag || isMockData
                        }
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
                        disabled={isCreatingGroup || isMockData}
                        aria-label="New group name"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={
                          !newGroupName.trim() ||
                          isCreatingGroup ||
                          isMockData
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
                        />
                      ))
                    : null}
                </AssignmentColumn>
              </div>

              <div className="mt-5 flex justify-end border-t border-border pt-4">
                <Button
                  type="button"
                  disabled={
                    !hasAssignmentChanges ||
                    isSavingAssignments ||
                    isMockData
                  }
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

            {contact.notes ? (
              <Panel className="p-5 md:p-6">
                <PanelHeader title="Notes" className="mb-3" />
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {contact.notes}
                </p>
              </Panel>
            ) : null}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
