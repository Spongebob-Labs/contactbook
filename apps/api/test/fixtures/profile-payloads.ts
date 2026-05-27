import { ProfileDeletableGroupCategory } from "../../src/profile/dto/profile-deletable-group-category.enum";
import type { ProfileMeOnboardingDto } from "../../src/profile/dto/profile-me-onboarding.dto";
import type { ProfileMePatchDto } from "../../src/profile/dto/profile-me-upsert.dto";

export const TEST_USER_ID = "test-user-id";

export const registrationIdentity = {
  firstName: "Jane",
  lastName: "Doe",
  primaryEmail: "jane@example.com",
  primaryPhone: "+12025551234",
};

export const identityOnlyOnboarding: ProfileMeOnboardingDto = {
  identity: { ...registrationIdentity },
};

export const onboardingWithPersonalAndWork: ProfileMeOnboardingDto = {
  identity: { ...registrationIdentity },
  personal: {
    tag: "Primary Personal",
  },
  work: [{ tag: "Acme" }],
};

export const onboardingWithPersonalAndWorkFull: ProfileMeOnboardingDto = {
  identity: { ...registrationIdentity },
  personal: {
    tag: "Primary Personal",
    mobile: "+12025551234",
  },
  work: [
    {
      tag: "Acme",
      companyName: "Acme Corp",
      workTitle: "Engineer",
    },
  ],
};

/** Flattened GET-shaped onboarding body (HTTP validation + inflate). */
export const fullOnboardingPayload: ProfileMeOnboardingDto = {
  identity: {
    firstName: "Fardeen",
    lastName: "Khan",
    primaryPhone: "+919876543210",
    primaryEmail: "fardeen.private@gmail.com",
    profilePhoto: "https://storage.example.com/photo.jpg",
  },
  personal: {
    tag: "Primary Personal Details",
    title: "Mr.",
    nickname: "Fardeen",
    mobile: "+919876543210",
    email: "fardeen.private@gmail.com",
    postalAddress: {
      street: "Apartment 4B",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500033",
      country: "India",
    },
    relationshipStatus: "Married",
    custom: { "Blood Group": "O+" },
  },
  work: [
    {
      tag: "SaaS King (Current)",
      companyName: "SaaS King",
      workTitle: "Full-stack Architect",
      workEmail: "fardeen@saasking.com",
      workPostalAddress: {
        street: "Knowledge City",
        city: "Hyderabad",
        state: "Telangana",
        pincode: "500081",
        country: "India",
      },
      custom: { "Employee ID": "SK-042" },
    },
  ],
  business: [
    {
      tag: "NK Fashion",
      businessName: "Stitch Platform",
      businessTitle: "Founder",
      custom: { "Business Type": "LLP", GSTIN: "36AAAAA1234A1Z5" },
    },
  ],
  socials: [
    {
      tag: "Main Digital Presence",
      skype: "live:fardeen.architect",
      whatsApp: "+919876543210",
      website: "https://fardeenkhan.com",
      custom: {
        LinkedIn: "https://linkedin.com/in/fardeenkhan",
        GitHub: "https://github.com/fardeenk",
      },
    },
  ],
  financial: {
    bankAccounts: [
      {
        tag: "Freelance Invoicing",
        bankName: "HDFC Bank",
        accountHolder: "Fardeen Khan",
        accountNumber: "50100234567890",
        ifsc: "HDFC0001234",
        currency: "INR",
        isSensitive: true,
      },
    ],
    digitalWallets: [
      {
        tag: "Personal UPI",
        platform: "UPI",
        handleOrLink: "fardeen@okhdfc",
        isSensitive: true,
      },
    ],
  },
};

export const onboardingWithInvalidWorkGroupId: ProfileMeOnboardingDto = {
  identity: { ...registrationIdentity },
  work: [
    {
      groupId: "3c851c68-3e06-df86-87b6-b70a5ec9a936",
      tag: "Acme",
      companyName: "Acme",
    },
  ],
};

export const onboardingWithEmptyShells: ProfileMeOnboardingDto = {
  identity: { ...registrationIdentity },
  work: [],
  personal: { tag: "" },
};

/** Intentionally includes read-only field (not on ProfileMeOnboardingDto). */
export const onboardingRejectsReadOnlyTimestamp = {
  identity: { ...registrationIdentity },
  profileOnboardingCompletedAt: "2026-05-20T17:00:38.895Z",
};

export const patchPersonalMobile: ProfileMePatchDto = {
  personal: { tag: "Primary", mobile: "+12025559999" },
};

export const patchIdentityInvalidPhone: ProfileMePatchDto = {
  identity: { primaryPhone: "not-a-phone" },
};

export const deleteWorkGroupDto = {
  groupId: "11111111-1111-4111-8111-111111111111",
  category: ProfileDeletableGroupCategory.WORK,
};

export const validConnectionRequest = {
  recipientPhone: "5559876543",
  recipientCountryCode: "+1",
};

export const invalidConnectionRequest = {
  recipientPhone: "abc",
  recipientCountryCode: "+1",
};

export const validWhatsappRequest = {
  phone: "5551234567",
  countryCode: "+1",
};

export const invalidWhatsappRequest = {
  phone: "12",
  countryCode: "1",
};
