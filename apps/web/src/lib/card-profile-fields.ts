/**
 * Bridges the profile to the card UI.
 *
 * A card owns no data of its own — its vCard is built from profile fields
 * mapped to it. So "editing a card's details" means editing the profile group
 * the card draws from, scoped by card type:
 *
 * - PERSONAL / CUSTOM → the `personal` group, `socials`, and the identity photo
 * - BUSINESS ("Work") → the first `work` group
 *
 * Values are written with `PATCH /v1/profile/me`. Beware: the API reconciles
 * `work`/`socials` destructively — any key omitted from the group is deleted —
 * so the patch builders below always resend the whole group.
 */
import type {
  PostalAddress,
  ProfileMeResponse,
  ContactCardType,
} from "@/lib/types";
import type { ShareableFieldType } from "@/lib/card-share-types";

export type CardProfileAddress = {
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
};

export const EMPTY_ADDRESS: CardProfileAddress = {
  street: "",
  city: "",
  state: "",
  pincode: "",
  country: "",
};

export type CardProfileInputKind =
  | "text"
  | "tel"
  | "email"
  | "url"
  | "date"
  | "address"
  | "photo";

export type CardProfileField = {
  /** Stable key for React lists and for the edit map. */
  key: string;
  type: ShareableFieldType;
  label: string;
  hint?: string;
  inputKind: CardProfileInputKind;
  /** Current value; "" when unset. Empty for `address` — use `address`. */
  value: string;
  address?: CardProfileAddress;
  /** False when the API has no way to store this — rendered read-only. */
  editable: boolean;
  /** Shown when `editable` is false, so the user knows why. */
  unavailableReason?: string;
};

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toAddress(value: PostalAddress | undefined): CardProfileAddress {
  if (!value) {
    return { ...EMPTY_ADDRESS };
  }
  return {
    street: str(value.street),
    city: str(value.city),
    state: str(value.state),
    pincode: str(value.pincode),
    country: str(value.country),
  };
}

export function isAddressEmpty(address: CardProfileAddress): boolean {
  return !Object.values(address).some((part) => part.trim().length > 0);
}

export function formatAddress(address: CardProfileAddress): string {
  return [address.street, address.city, address.state, address.pincode, address.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

/** Card types that read from the `work` group rather than `personal`. */
export function usesWorkGroup(cardType: ContactCardType): boolean {
  return cardType === "BUSINESS";
}

const DEPARTMENT_UNAVAILABLE =
  "Your profile has nowhere to store a department yet, so this can't be filled in.";

const BIRTHDAY_HINT =
  "Saved to your profile and sent as the contact's birthday whenever Birthday is ticked.";

const LINKEDIN_UNAVAILABLE =
  "Your profile can't store a LinkedIn link yet — the server rejects it.";

/**
 * Social keys `PATCH /v1/profile/me` actually accepts. The server whitelists
 * them and 400s on anything else — `linkedin` and `github` are rejected even
 * though the response type mentions them, so they must never be sent.
 */
const ALLOWED_SOCIAL_KEYS = [
  "website",
  "facebook",
  "twitter",
  "whatsApp",
  "blog",
  "skype",
  "bbmPin",
  "asw",
  "bebo",
] as const;

/**
 * The editable detail rows for a card, in the order they should be shown.
 * Values come straight from `GET /v1/profile/me`.
 */
export function listCardProfileFields(
  profile: ProfileMeResponse | null,
  cardType: ContactCardType,
): CardProfileField[] {
  if (usesWorkGroup(cardType)) {
    const work = profile?.work?.[0];
    return [
      {
        key: "companyLogo",
        type: "PHOTO",
        label: "Logo",
        inputKind: "photo",
        value: str(work?.companyLogo),
        editable: true,
      },
      {
        key: "companyName",
        type: "COMPANY",
        label: "Company",
        inputKind: "text",
        value: str(work?.companyName),
        editable: true,
      },
      {
        key: "workTitle",
        type: "JOB_TITLE",
        label: "Job title",
        inputKind: "text",
        value: str(work?.workTitle),
        editable: true,
      },
      {
        key: "department",
        type: "DEPARTMENT",
        label: "Department",
        inputKind: "text",
        value: "",
        editable: false,
        unavailableReason: DEPARTMENT_UNAVAILABLE,
      },
      {
        key: "workMobile",
        type: "PHONE",
        label: "Mobile",
        inputKind: "tel",
        value: str(work?.workMobile),
        editable: true,
      },
      {
        key: "workLandline",
        type: "LANDLINE",
        label: "Landline",
        inputKind: "tel",
        value: str(work?.workLandline),
        editable: true,
      },
      {
        key: "workFax",
        type: "FAX",
        label: "Fax",
        inputKind: "tel",
        value: str(work?.workFax),
        editable: true,
      },
      {
        key: "workEmail",
        type: "EMAIL",
        label: "Email",
        inputKind: "email",
        value: str(work?.workEmail),
        editable: true,
      },
      {
        key: "website",
        type: "URL",
        label: "Website",
        inputKind: "url",
        value: str(work?.website),
        editable: true,
      },
      {
        key: "workPostalAddress",
        type: "ADDRESS",
        label: "Address",
        inputKind: "address",
        value: "",
        address: toAddress(work?.workPostalAddress),
        editable: true,
      },
    ];
  }

  const personal = profile?.personal;
  const social = profile?.socials?.[0];
  return [
    {
      key: "profilePhoto",
      type: "PHOTO",
      label: "Photo",
      inputKind: "photo",
      value: str(profile?.identity.profilePhoto),
      editable: true,
    },
    {
      key: "mobile",
      type: "PHONE",
      label: "Mobile",
      inputKind: "tel",
      value: str(personal?.mobile),
      editable: true,
    },
    {
      key: "landline",
      type: "LANDLINE",
      label: "Landline",
      inputKind: "tel",
      value: str(personal?.landline),
      editable: true,
    },
    {
      key: "email",
      type: "EMAIL",
      label: "Email",
      inputKind: "email",
      value: str(personal?.email),
      editable: true,
    },
    {
      key: "postalAddress",
      type: "ADDRESS",
      label: "Address",
      inputKind: "address",
      value: "",
      address: toAddress(personal?.postalAddress),
      editable: true,
    },
    {
      key: "dateOfBirth",
      type: "DATE",
      label: "Birthday",
      hint: BIRTHDAY_HINT,
      inputKind: "date",
      value: str(personal?.dateOfBirth),
      editable: true,
    },
    {
      key: "website",
      type: "URL",
      label: "Website",
      inputKind: "url",
      value: str(social?.website),
      editable: true,
    },
    {
      key: "facebook",
      type: "SOCIAL_LINK",
      label: "Facebook",
      inputKind: "url",
      value: str(social?.facebook),
      editable: true,
    },
    {
      key: "twitter",
      type: "SOCIAL_LINK",
      label: "X / Twitter",
      inputKind: "url",
      value: str(social?.twitter),
      editable: true,
    },
    {
      key: "whatsApp",
      type: "SOCIAL_LINK",
      label: "WhatsApp",
      inputKind: "url",
      value: str(social?.whatsApp),
      editable: true,
    },
    {
      key: "blog",
      type: "SOCIAL_LINK",
      label: "Blog",
      inputKind: "url",
      value: str(social?.blog),
      editable: true,
    },
    {
      key: "linkedin",
      type: "SOCIAL_LINK",
      label: "LinkedIn",
      inputKind: "url",
      value: str(social?.linkedin),
      editable: false,
      unavailableReason: LINKEDIN_UNAVAILABLE,
    },
  ];
}

export type CardProfileEdits = {
  values: Record<string, string>;
  addresses: Record<string, CardProfileAddress>;
};

function addressPayload(address: CardProfileAddress) {
  if (isAddressEmpty(address)) {
    return undefined;
  }
  return {
    street: address.street.trim(),
    city: address.city.trim(),
    state: address.state.trim() || null,
    pincode: address.pincode.trim() || null,
    country: address.country.trim() || "IN",
  };
}

/**
 * Builds the `PATCH /v1/profile/me` body for a card's detail edits.
 *
 * `work` and `socials` are resent whole — the API deletes any field missing
 * from the group it receives.
 */
export function buildCardProfilePatch(
  profile: ProfileMeResponse | null,
  cardType: ContactCardType,
  edits: CardProfileEdits,
): Record<string, unknown> {
  const value = (key: string, fallback: string) =>
    edits.values[key] !== undefined ? edits.values[key].trim() : fallback;
  const address = (key: string, fallback: CardProfileAddress) =>
    edits.addresses[key] ?? fallback;

  if (usesWorkGroup(cardType)) {
    const work = profile?.work?.[0];
    return {
      work: [
        {
          ...(work?.groupId ? { groupId: work.groupId } : {}),
          tag: work?.tag ?? "Work",
          companyName: value("companyName", str(work?.companyName)) || null,
          companyLogo: value("companyLogo", str(work?.companyLogo)) || null,
          workTitle: value("workTitle", str(work?.workTitle)) || null,
          workMobile: value("workMobile", str(work?.workMobile)) || null,
          workLandline: value("workLandline", str(work?.workLandline)) || null,
          workFax: value("workFax", str(work?.workFax)) || null,
          workEmail: value("workEmail", str(work?.workEmail)) || null,
          website: value("website", str(work?.website)) || null,
          workPostalAddress: addressPayload(
            address("workPostalAddress", toAddress(work?.workPostalAddress)),
          ),
          ...(work?.companyRegNumber ? { companyRegNumber: work.companyRegNumber } : {}),
          ...(work?.employeeId ? { employeeId: work.employeeId } : {}),
          ...(work?.custom ? { custom: work.custom } : {}),
        },
      ],
    };
  }

  const personal = profile?.personal;
  const social = profile?.socials?.[0];
  const photo = value("profilePhoto", str(profile?.identity.profilePhoto));

  return {
    // `personal` is additive server-side, so a partial object is safe here.
    personal: {
      ...(personal?.groupId ? { groupId: personal.groupId } : {}),
      mobile: value("mobile", str(personal?.mobile)) || null,
      landline: value("landline", str(personal?.landline)) || null,
      email: value("email", str(personal?.email)) || null,
      dateOfBirth: value("dateOfBirth", str(personal?.dateOfBirth)) || null,
      postalAddress: addressPayload(
        address("postalAddress", toAddress(personal?.postalAddress)),
      ),
    },
    identity: {
      firstName: profile?.identity.firstName ?? "",
      lastName: profile?.identity.lastName ?? "",
      primaryPhone: profile?.identity.primaryPhone ?? "",
      primaryEmail: profile?.identity.primaryEmail ?? "",
      profilePhoto: photo || null,
    },
    socials: [buildSocialsPayload(social, value)],
  };
}

type SocialGroup = NonNullable<ProfileMeResponse["socials"]>[number];

/**
 * Only whitelisted keys, resent whole because the server reconciles this group
 * destructively. Anything outside `ALLOWED_SOCIAL_KEYS` — `linkedin`, `github`,
 * or a stray key carried over from a GET — makes the request 400.
 */
function buildSocialsPayload(
  social: SocialGroup | undefined,
  value: (key: string, fallback: string) => string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    ...(social?.groupId ? { groupId: social.groupId } : {}),
    tag: social?.tag ?? "Social",
    ...(social?.custom ? { custom: social.custom } : {}),
  };

  for (const key of ALLOWED_SOCIAL_KEYS) {
    const current = str((social as Record<string, unknown> | undefined)?.[key]);
    const next = value(key, current);
    // Skip keys that are neither stored nor being edited, so an untouched
    // profile is not spammed with nulls.
    if (!next && !current) {
      continue;
    }
    payload[key] = next || null;
  }

  return payload;
}
