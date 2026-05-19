import type { ContactDetail, ContactSource } from "@/lib/types";

type MockContactInput = {
  id: string;
  source: ContactSource;
  displayName: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  department?: string;
  title?: string;
  city?: string;
  region?: string;
  country?: string;
  updatedAt: string;
};

function createMockContact(input: MockContactInput): ContactDetail {
  return {
    id: input.id,
    source: input.source,
    externalId: `${input.source.toLowerCase()}-${input.id}`,
    sourceRevision: `rev-${input.id}`,
    displayName: input.displayName,
    firstName: input.firstName,
    lastName: input.lastName,
    middleName: null,
    nickname: null,
    notes: null,
    primaryPhone: input.phone
      ? { value: input.phone, label: "mobile", isPrimary: true }
      : null,
    primaryEmail: input.email
      ? { value: input.email, label: "work", isPrimary: true }
      : null,
    phones: input.phone
      ? [{ value: input.phone, label: "mobile", isPrimary: true }]
      : [],
    emails: input.email
      ? [{ value: input.email, label: "work", isPrimary: true }]
      : [],
    organizations: input.company
      ? [
          {
            companyName: input.company,
            department: input.department ?? null,
            title: input.title ?? null,
            isPrimary: true,
          },
        ]
      : [],
    addresses: input.country
      ? [
          {
            street: null,
            city: input.city ?? null,
            region: input.region ?? null,
            postalCode: null,
            country: input.country,
            label: "work",
            isPrimary: true,
          },
        ]
      : [],
    urls: [],
    createdAt: "2026-05-01T08:30:00.000Z",
    updatedAt: input.updatedAt,
    deletedAt: null,
  };
}

export const mockContacts: ContactDetail[] = [
  createMockContact({
    id: "0e1f5d8a-5a54-4c1b-9b5b-7f86ec963001",
    source: "GOOGLE",
    displayName: "Aarav Mehta",
    firstName: "Aarav",
    lastName: "Mehta",
    email: "aarav.mehta@northstar.example",
    phone: "+91 98765 44001",
    company: "Northstar Labs",
    department: "Product",
    title: "Product Lead",
    city: "Bengaluru",
    region: "Karnataka",
    country: "India",
    updatedAt: "2026-05-18T11:20:00.000Z",
  }),
  createMockContact({
    id: "0e1f5d8a-5a54-4c1b-9b5b-7f86ec963002",
    source: "GOOGLE",
    displayName: "Maya Chen",
    firstName: "Maya",
    lastName: "Chen",
    email: "maya.chen@atlas.example",
    phone: "+1 415 555 0102",
    company: "Atlas Systems",
    department: "Partnerships",
    title: "Director",
    city: "San Francisco",
    region: "California",
    country: "United States",
    updatedAt: "2026-05-17T15:05:00.000Z",
  }),
  createMockContact({
    id: "0e1f5d8a-5a54-4c1b-9b5b-7f86ec963003",
    source: "MANUAL",
    displayName: "Imani Okafor",
    firstName: "Imani",
    lastName: "Okafor",
    email: "imani.okafor@kairo.example",
    phone: "+44 20 7946 0103",
    company: "Kairo Health",
    department: "Operations",
    title: "COO",
    city: "London",
    country: "United Kingdom",
    updatedAt: "2026-05-16T09:45:00.000Z",
  }),
  createMockContact({
    id: "0e1f5d8a-5a54-4c1b-9b5b-7f86ec963004",
    source: "CSV",
    displayName: "Noah Williams",
    firstName: "Noah",
    lastName: "Williams",
    email: "noah@harbor.example",
    phone: "+1 212 555 0104",
    company: "Harbor Finance",
    department: "Investor Relations",
    title: "Associate",
    city: "New York",
    region: "New York",
    country: "United States",
    updatedAt: "2026-05-15T14:18:00.000Z",
  }),
  createMockContact({
    id: "0e1f5d8a-5a54-4c1b-9b5b-7f86ec963005",
    source: "GOOGLE",
    displayName: "Sofia Rossi",
    firstName: "Sofia",
    lastName: "Rossi",
    email: "sofia.rossi@lumina.example",
    phone: "+39 06 5550 0105",
    company: "Lumina Studio",
    department: "Design",
    title: "Creative Director",
    city: "Rome",
    country: "Italy",
    updatedAt: "2026-05-14T10:10:00.000Z",
  }),
  createMockContact({
    id: "0e1f5d8a-5a54-4c1b-9b5b-7f86ec963006",
    source: "ICLOUD",
    displayName: "Kenji Tanaka",
    firstName: "Kenji",
    lastName: "Tanaka",
    email: "kenji.tanaka@orbit.example",
    phone: "+81 3 5550 0106",
    company: "Orbit Retail",
    department: "Growth",
    title: "GM Japan",
    city: "Tokyo",
    country: "Japan",
    updatedAt: "2026-05-13T13:12:00.000Z",
  }),
  createMockContact({
    id: "0e1f5d8a-5a54-4c1b-9b5b-7f86ec963007",
    source: "MANUAL",
    displayName: "Priya Nair",
    firstName: "Priya",
    lastName: "Nair",
    email: "priya.nair@evergreen.example",
    phone: "+91 99887 76007",
    company: "Evergreen Mobility",
    department: "Customer Success",
    title: "Head of Success",
    city: "Mumbai",
    region: "Maharashtra",
    country: "India",
    updatedAt: "2026-05-12T16:00:00.000Z",
  }),
  createMockContact({
    id: "0e1f5d8a-5a54-4c1b-9b5b-7f86ec963008",
    source: "GOOGLE",
    displayName: "Lucas Martin",
    firstName: "Lucas",
    lastName: "Martin",
    email: "lucas.martin@terra.example",
    phone: "+33 1 55 50 01 08",
    company: "Terra Foods",
    department: "Supply",
    title: "Procurement Lead",
    city: "Paris",
    country: "France",
    updatedAt: "2026-05-11T12:25:00.000Z",
  }),
  createMockContact({
    id: "0e1f5d8a-5a54-4c1b-9b5b-7f86ec963009",
    source: "CSV",
    displayName: "Amara Singh",
    firstName: "Amara",
    lastName: "Singh",
    email: "amara.singh@northstar.example",
    phone: "+91 98765 44009",
    company: "Northstar Labs",
    department: "Engineering",
    title: "Staff Engineer",
    city: "Delhi",
    country: "India",
    updatedAt: "2026-05-10T07:55:00.000Z",
  }),
  createMockContact({
    id: "0e1f5d8a-5a54-4c1b-9b5b-7f86ec963010",
    source: "GOOGLE",
    displayName: "Elena Garcia",
    firstName: "Elena",
    lastName: "Garcia",
    email: "elena.garcia@harbor.example",
    company: "Harbor Finance",
    department: "Legal",
    title: "Counsel",
    city: "Madrid",
    country: "Spain",
    updatedAt: "2026-05-09T18:35:00.000Z",
  }),
  createMockContact({
    id: "0e1f5d8a-5a54-4c1b-9b5b-7f86ec963011",
    source: "MANUAL",
    displayName: "Owen Brooks",
    firstName: "Owen",
    lastName: "Brooks",
    phone: "+61 2 5550 0111",
    company: "Kairo Health",
    department: "Clinical",
    title: "Program Manager",
    city: "Sydney",
    country: "Australia",
    updatedAt: "2026-05-08T08:42:00.000Z",
  }),
  createMockContact({
    id: "0e1f5d8a-5a54-4c1b-9b5b-7f86ec963012",
    source: "GOOGLE",
    displayName: "Fatima Al Saud",
    firstName: "Fatima",
    lastName: "Al Saud",
    email: "fatima@desertline.example",
    phone: "+971 4 555 0112",
    company: "Desertline Ventures",
    department: "Investments",
    title: "Principal",
    city: "Dubai",
    country: "United Arab Emirates",
    updatedAt: "2026-05-07T11:05:00.000Z",
  }),
];
