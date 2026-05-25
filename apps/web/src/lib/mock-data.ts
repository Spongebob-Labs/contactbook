import type {
  ContactCard,
  ContactDetail,
  ContactListResponse,
  ContactSource,
  ProfileMeResponse,
} from "@/lib/types";

const now = "2026-05-22T09:00:00.000Z";

export const mockContacts: ContactDetail[] = [
  {
    id: "sample-contact-1",
    source: "GOOGLE",
    externalId: "sample/google/1",
    mergeGroupId: "sample-group-1",
    displayName: "Avery Johnson",
    firstName: "Avery",
    lastName: "Johnson",
    primaryPhone: { value: "+1 555 0101", label: "mobile", isPrimary: true },
    primaryEmail: {
      value: "avery@example.com",
      label: "work",
      isPrimary: true,
    },
    createdAt: now,
    updatedAt: now,
    sourceRevision: null,
    middleName: null,
    nickname: "AJ",
    notes: "Sample contact shown while live data is unavailable.",
    phones: [{ value: "+1 555 0101", label: "mobile", isPrimary: true }],
    emails: [{ value: "avery@example.com", label: "work", isPrimary: true }],
    organizations: [
      {
        companyName: "Northstar Studio",
        department: "Partnerships",
        title: "Partner Lead",
        isPrimary: true,
      },
    ],
    addresses: [
      {
        city: "San Francisco",
        region: "CA",
        country: "United States",
        label: "work",
        isPrimary: true,
      },
    ],
    urls: [{ value: "https://example.com", label: "Website" }],
    deletedAt: null,
  },
  {
    id: "sample-contact-2",
    source: "CSV",
    externalId: "sample/csv/2",
    mergeGroupId: "sample-group-2",
    displayName: "Maya Patel",
    firstName: "Maya",
    lastName: "Patel",
    primaryPhone: { value: "+1 555 0102", label: "office", isPrimary: true },
    primaryEmail: {
      value: "maya@example.com",
      label: "home",
      isPrimary: true,
    },
    createdAt: now,
    updatedAt: now,
    sourceRevision: null,
    middleName: null,
    nickname: null,
    notes: null,
    phones: [{ value: "+1 555 0102", label: "office", isPrimary: true }],
    emails: [{ value: "maya@example.com", label: "home", isPrimary: true }],
    organizations: [],
    addresses: [],
    urls: [],
    deletedAt: null,
  },
];

export const mockContactListResponse: ContactListResponse = {
  items: mockContacts,
  page: 1,
  limit: 25,
  total: mockContacts.length,
  totalPages: 1,
};

export function mockContactsBySource(source: ContactSource): ContactListResponse {
  const items = mockContacts.filter((contact) => contact.source === source);
  return {
    items,
    page: 1,
    limit: 100,
    total: items.length,
    totalPages: 1,
  };
}

export function mockContactDetail(contactId: string | undefined): ContactDetail {
  return (
    mockContacts.find((contact) => contact.id === contactId) ?? mockContacts[0]
  );
}

export const mockCards: ContactCard[] = [
  {
    id: "sample-card-1",
    userId: "sample-user",
    name: "Personal profile",
    type: "PERSONAL",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "sample-card-2",
    userId: "sample-user",
    name: "Business card",
    type: "BUSINESS",
    createdAt: now,
    updatedAt: now,
  },
];

export function mockCardDetail(cardId: string | undefined): ContactCard {
  return mockCards.find((card) => card.id === cardId) ?? mockCards[0];
}

export const mockProfile: ProfileMeResponse = {
  profileOnboardingCompletedAt: now,
  identity: {
    firstName: "Alex",
    lastName: "Morgan",
    primaryPhone: "+1 555 0100",
    primaryEmail: "alex@example.com",
    profilePhoto: null,
  },
  personal: {
    groupId: "sample-personal",
    tag: "Personal",
    mobile: "+1 555 0100",
    email: "alex@example.com",
    currentLocation: "New York",
    relationshipStatus: null,
    custom: {
      nickname: "Alex",
      title: "Product builder",
    },
  },
  work: [
    {
      groupId: "sample-work",
      tag: "Work",
      companyName: "ContactBook",
      workTitle: "Product lead",
      workEmail: "work@example.com",
      custom: {},
    },
  ],
  business: [],
  socials: [
    {
      groupId: "sample-social",
      tag: "Social",
      linkedin: "https://linkedin.com",
      custom: {},
    },
  ],
  financial: {
    bankAccounts: [],
    digitalWallets: [],
    cryptoWallets: [],
  },
};
