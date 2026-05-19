import type { ContactDetail } from "@/lib/types";

export function getContactName(contact: ContactDetail) {
  if (contact.displayName?.trim()) {
    return contact.displayName.trim();
  }
  return (
    [contact.firstName, contact.lastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ") || "Unnamed contact"
  );
}

export function getInitials(contact: ContactDetail) {
  const name = getContactName(contact);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return initials || "?";
}

export function getPrimaryOrganization(contact: ContactDetail) {
  return (
    contact.organizations.find((organization) => organization.isPrimary) ??
    contact.organizations[0] ??
    null
  );
}

export function getPrimaryAddress(contact: ContactDetail) {
  return (
    contact.addresses.find((address) => address.isPrimary) ??
    contact.addresses[0] ??
    null
  );
}

export function getCompany(contact: ContactDetail) {
  return getPrimaryOrganization(contact)?.companyName ?? "";
}

export function getTitle(contact: ContactDetail) {
  return getPrimaryOrganization(contact)?.title ?? "";
}

export function getLocation(contact: ContactDetail) {
  const address = getPrimaryAddress(contact);
  if (!address) {
    return "";
  }
  return [address.city, address.region, address.country].filter(Boolean).join(", ");
}

export function getPrimaryEmail(contact: ContactDetail) {
  return contact.primaryEmail?.value ?? contact.emails[0]?.value ?? "";
}

export function getPrimaryPhone(contact: ContactDetail) {
  return contact.primaryPhone?.value ?? contact.phones[0]?.value ?? "";
}

export function getSearchText(contact: ContactDetail) {
  return [
    getContactName(contact),
    getPrimaryEmail(contact),
    getPrimaryPhone(contact),
    getCompany(contact),
    getTitle(contact),
    getLocation(contact),
    contact.source,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function formatContactDate(value: string | null | undefined) {
  if (!value) {
    return "Not synced";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}
