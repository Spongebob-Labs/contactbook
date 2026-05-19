import type { ContactSource } from "@prisma/client";

export type NormalizedPhone = {
  value: string;
  label?: string | null;
  isPrimary?: boolean;
};

export type NormalizedEmail = {
  value: string;
  label?: string | null;
  isPrimary?: boolean;
};

export type NormalizedOrganization = {
  companyName?: string | null;
  department?: string | null;
  title?: string | null;
  isPrimary?: boolean;
};

export type NormalizedAddress = {
  street?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  label?: string | null;
  isPrimary?: boolean;
};

export type NormalizedUrl = {
  value: string;
  label?: string | null;
};

/** In-memory import shape — never persisted as JSON on Contact rows. */
export type NormalizedContact = {
  source: ContactSource;
  externalId: string;
  sourceRevision?: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
  namePrefix?: string | null;
  nameSuffix?: string | null;
  nickname?: string | null;
  notes?: string | null;
  phones: NormalizedPhone[];
  emails: NormalizedEmail[];
  organizations: NormalizedOrganization[];
  addresses: NormalizedAddress[];
  urls: NormalizedUrl[];
  deleted?: boolean;
};
