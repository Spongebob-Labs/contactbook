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
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
    <div className="flex gap-3 rounded-md border border-border p-4">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <p className="mt-1 break-words text-sm">{value}</p>
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
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {children ?? <p className="text-sm text-muted-foreground">{empty}</p>}
      </CardContent>
    </Card>
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
              first.name.localeCompare(second.name, undefined, { sensitivity: "base" }),
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
              first.name.localeCompare(second.name, undefined, { sensitivity: "base" }),
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
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/dashboard/contacts"
          className={buttonVariants({ variant: "outline" })}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Contacts
        </Link>
      </section>

      {error && (
        <Alert className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium">Could not load contact</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {friendlyErrorMessages.load}
            </p>
          </div>
        </Alert>
      )}

      {isMockData && <SampleDataNotice />}

      {isLoading && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-14 w-14 rounded-full" />
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && contact && (
        <>
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <ContactAvatar contact={contact} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-semibold tracking-normal">
                        {getContactName(contact)}
                      </h1>
                      <Badge variant="secondary">{contact.source.toLowerCase()}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {getCompany(contact) || getTitle(contact) || "Contact"}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:text-right">
                  <p>Created {formatContactDate(contact.createdAt)}</p>
                  <p>Updated {formatContactDate(contact.updatedAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

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

          <Card>
            <CardHeader>
              <CardTitle>Tags & groups</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[24px] border border-border bg-background/60 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <Tags className="h-4 w-4 text-primary" aria-hidden="true" />
                    Tags
                  </div>
                  {availableTags.length > 0 ? (
                    <div className="grid gap-2">
                      {availableTags.map((tag) => (
                        <label
                          key={tag.id}
                          className="flex cursor-pointer items-center gap-3 rounded-full px-3 py-2 text-sm transition-colors hover:bg-muted"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTagIds.includes(tag.id)}
                            onChange={() =>
                              setSelectedTagIds((current) => toggleId(current, tag.id))
                            }
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="truncate">{tag.name}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No tags yet</p>
                  )}
                  <div className="mt-4 rounded-[20px] border border-dashed border-border bg-card/70 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
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
                        className="rounded-full"
                        disabled={isCreatingTag || isMockData}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        disabled={!newTagName.trim() || isCreatingTag || isMockData}
                        onClick={() => void createAndAssignTag()}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        {isCreatingTag ? "Adding" : "Add"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-border bg-background/60 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <FolderKanban className="h-4 w-4 text-primary" aria-hidden="true" />
                    Groups
                  </div>
                  {availableGroups.length > 0 ? (
                    <div className="grid gap-2">
                      {availableGroups.map((group) => (
                        <label
                          key={group.id}
                          className="flex cursor-pointer items-center justify-between gap-3 rounded-full px-3 py-2 text-sm transition-colors hover:bg-muted"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedGroupIds.includes(group.id)}
                              onChange={() =>
                                setSelectedGroupIds((current) =>
                                  toggleId(current, group.id),
                                )
                              }
                              className="h-4 w-4 accent-primary"
                            />
                            <span className="truncate">{group.name}</span>
                          </span>
                          {group.source && (
                            <Badge variant="secondary" className="rounded-full">
                              {group.source.toLowerCase()}
                            </Badge>
                          )}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No groups yet</p>
                  )}
                  <div className="mt-4 rounded-[20px] border border-dashed border-border bg-card/70 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={newGroupName}
                        onChange={(event) => setNewGroupName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void createAndAssignGroup();
                          }
                        }}
                        placeholder="Add new group"
                        className="rounded-full"
                        disabled={isCreatingGroup || isMockData}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        disabled={!newGroupName.trim() || isCreatingGroup || isMockData}
                        onClick={() => void createAndAssignGroup()}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        {isCreatingGroup ? "Adding" : "Add"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="rounded-full"
                  disabled={!hasAssignmentChanges || isSavingAssignments || isMockData}
                  onClick={() => void saveAssignments()}
                >
                  {isSavingAssignments ? "Saving" : "Save assignments"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <section className="grid gap-4 xl:grid-cols-2">
            <ListSection title="Phones" empty="No phone numbers">
              {contact.phones.length > 0 ? (
                <div className="grid gap-2">
                  {contact.phones.map((phone) => (
                    <div key={`${phone.value}-${phone.label ?? "phone"}`} className="rounded-md border border-border p-3">
                      <p className="font-medium">{phone.value}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {phone.label ?? "Phone"}{phone.isPrimary ? " - Primary" : ""}
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
                    <div key={`${email.value}-${email.label ?? "email"}`} className="rounded-md border border-border p-3">
                      <p className="font-medium">{email.value}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {email.label ?? "Email"}{email.isPrimary ? " - Primary" : ""}
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
                    <div key={`${organization.companyName ?? "organization"}-${index}`} className="rounded-md border border-border p-3">
                      <div className="flex items-start gap-3">
                        <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <div>
                          <p className="font-medium">
                            {organization.companyName ?? "Organization"}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {[organization.title, organization.department]
                              .filter(Boolean)
                              .join(" - ") || "No role details"}
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
                    <div key={`${address.street ?? "address"}-${index}`} className="rounded-md border border-border p-3">
                      <p className="font-medium">
                        {[address.street, address.city, address.region]
                          .filter(Boolean)
                          .join(", ") || "Address"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {[address.postalCode, address.country].filter(Boolean).join(", ") ||
                          "No location details"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </ListSection>
          </section>

          <section>
            <ListSection title="URLs" empty="No URLs">
              {contact.urls.length > 0 ? (
                <div className="grid gap-2">
                  {contact.urls.map((url) => (
                    <div key={url.value} className="flex items-start gap-3 rounded-md border border-border p-3">
                      <Globe className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0">
                        <a
                          href={url.value}
                          target="_blank"
                          rel="noreferrer"
                          className="break-words font-medium hover:underline"
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
          </section>

          {contact.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {contact.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </AppShell>
  );
}
