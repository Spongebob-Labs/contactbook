import { ContactSource } from "@prisma/client";
import type { people_v1 } from "googleapis";
import type { NormalizedContact } from "./normalized-contact.types";

function trimOrNull(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t && t.length > 0 ? t : null;
}

function primaryIndex<T extends { metadata?: { primary?: boolean | null } | null }>(
  list: T[],
): number {
  const idx = list.findIndex((item) => item.metadata?.primary === true);
  return idx >= 0 ? idx : 0;
}

export function googlePersonToNormalizedContact(
  person: people_v1.Schema$Person,
): NormalizedContact | null {
  const externalId = person.resourceName?.trim();
  if (!externalId) {
    return null;
  }

  const names = person.names ?? [];
  const primaryName = names[primaryIndex(names)];

  const phones = (person.phoneNumbers ?? []).map((p, i, arr) => ({
    value: trimOrNull(p.value) ?? "",
    label: trimOrNull(p.type ?? p.formattedType),
    isPrimary:
      p.metadata?.primary === true ||
      (i === primaryIndex(arr) && !arr.some((x) => x.metadata?.primary)),
  })).filter((p) => p.value.length > 0);

  const emails = (person.emailAddresses ?? []).map((e, i, arr) => ({
    value: (trimOrNull(e.value)?.toLowerCase() ?? ""),
    label: trimOrNull(e.type ?? e.formattedType),
    isPrimary:
      e.metadata?.primary === true ||
      (i === primaryIndex(arr) && !arr.some((x) => x.metadata?.primary)),
  })).filter((e) => e.value.length > 0);

  const organizations = (person.organizations ?? []).map((o, i, arr) => ({
    companyName: trimOrNull(o.name),
    department: trimOrNull(o.department),
    title: trimOrNull(o.title),
    isPrimary:
      o.metadata?.primary === true ||
      (i === primaryIndex(arr) && !arr.some((x) => x.metadata?.primary)),
  }));

  const displayName =
    trimOrNull(primaryName?.displayName) ??
    trimOrNull(
      [primaryName?.givenName, primaryName?.familyName]
        .filter(Boolean)
        .join(" "),
    );

  return {
    source: ContactSource.GOOGLE,
    externalId,
    sourceRevision: trimOrNull(person.etag),
    displayName,
    firstName: trimOrNull(primaryName?.givenName),
    lastName: trimOrNull(primaryName?.familyName),
    middleName: trimOrNull(primaryName?.middleName),
    namePrefix: trimOrNull(primaryName?.honorificPrefix),
    nameSuffix: trimOrNull(primaryName?.honorificSuffix),
    nickname: null,
    notes: null,
    phones,
    emails,
    organizations,
    addresses: [],
    urls: [],
    deleted: person.metadata?.deleted === true,
  };
}
