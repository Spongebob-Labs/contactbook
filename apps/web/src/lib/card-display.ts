import type { ContactCard, ProfileMeResponse } from "@/lib/types";

export type CardDisplayDetails = {
  company: string;
  email: string;
  initials: string;
  location: string;
  name: string;
  phone: string;
  role: string;
  social: string;
  website: string;
  linkedin: string;
  twitter: string;
  facebook: string;
  instagram: string;
  themePrimary: string | null;
};

function firstText(...values: Array<string | null | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? "";
}

function customValue(
  source: { custom?: Record<string, string> } | undefined,
  key: string,
) {
  return source?.custom?.[key];
}

function fullName(profile: ProfileMeResponse | null) {
  return firstText(
    [profile?.identity.firstName, profile?.identity.lastName]
      .filter(Boolean)
      .join(" "),
  );
}

function addressLine(address: ProfileMeResponse["personal"]["postalAddress"]) {
  if (!address) {
    return "";
  }

  return [address.city, address.state, address.country].filter(Boolean).join(", ");
}

function initialsFor(value: string) {
  const initials = value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials || "CB";
}

function emptySocials() {
  return {
    website: "",
    linkedin: "",
    twitter: "",
    facebook: "",
    instagram: "",
    themePrimary: null as string | null,
  };
}

export function getCardDisplayDetails(
  card: ContactCard,
  profile: ProfileMeResponse | null,
): CardDisplayDetails {
  if (card.fields) {
    const fields = card.fields;
    const personName = firstText(fields.displayName, card.name);
    return {
      company: firstText(fields.company),
      email: firstText(fields.email),
      initials: initialsFor(personName),
      location: firstText(fields.address),
      name: personName || card.name,
      phone: firstText(fields.phone),
      role: firstText(fields.title),
      social: firstText(
        fields.website,
        fields.linkedin,
        fields.instagram,
        fields.twitter,
        fields.facebook,
      ),
      website: firstText(fields.website),
      linkedin: firstText(fields.linkedin),
      twitter: firstText(fields.twitter),
      facebook: firstText(fields.facebook),
      instagram: firstText(fields.instagram),
      themePrimary: card.theme?.primary ?? null,
    };
  }

  const personal = profile?.personal;
  const work = profile?.work[0];
  const business = profile?.business[0];
  const social = profile?.socials[0];
  const personName = firstText(fullName(profile), card.name);
  const personalTitle = firstText(
    customValue(personal, "title"),
    customValue(personal, "nickname"),
    "Personal contact",
  );
  const personalLocation = firstText(
    personal?.currentLocation,
    addressLine(personal?.postalAddress),
    "New York, NY",
  );
  const workCompany = firstText(work?.companyName, business?.businessName, "ContactBook");
  const businessCompany = firstText(business?.businessName, work?.companyName, "ContactBook");
  const businessRole = firstText(
    business?.businessTitle,
    work?.workTitle,
    "Business contact",
  );
  const socialExtras = emptySocials();

  if (card.type === "BUSINESS") {
    return {
      company: businessCompany,
      email: firstText(business?.businessEmail, work?.workEmail, profile?.identity.primaryEmail, "hello@example.com"),
      initials: initialsFor(card.name),
      location: firstText(
        addressLine(business?.businessPostalAddress),
        addressLine(work?.workPostalAddress),
        "San Francisco, CA",
      ),
      name: card.name,
      phone: firstText(
        business?.businessMobile,
        business?.businessLandline,
        work?.workMobile,
        work?.workLandline,
        profile?.identity.primaryPhone,
        "+1 555 0102",
      ),
      role: businessRole,
      social: firstText(social?.linkedin, social?.website, "contactbook.app"),
      ...socialExtras,
      website: firstText(social?.website),
      linkedin: firstText(social?.linkedin),
      facebook: firstText(social?.facebook),
      themePrimary: card.theme?.primary ?? null,
    };
  }

  if (card.type === "CUSTOM" || card.type === "PAYMENT") {
    return {
      company: firstText(workCompany, "ContactBook"),
      email: firstText(profile?.identity.primaryEmail, "hello@example.com"),
      initials: initialsFor(card.name),
      location: personalLocation,
      name: card.name,
      phone: firstText(profile?.identity.primaryPhone, "+1 555 0103"),
      role: "Custom contact card",
      social: firstText(social?.website, social?.linkedin, "contactbook.app"),
      ...socialExtras,
      website: firstText(social?.website),
      linkedin: firstText(social?.linkedin),
      facebook: firstText(social?.facebook),
      themePrimary: card.theme?.primary ?? null,
    };
  }

  return {
    company: workCompany,
    email: firstText(personal?.email, profile?.identity.primaryEmail, "hello@example.com"),
    initials: initialsFor(personName),
    location: personalLocation,
    name: card.name,
    phone: firstText(personal?.mobile, profile?.identity.primaryPhone, "+1 555 0101"),
    role: personalTitle,
    social: firstText(
      customValue(social, "instagram"),
      social?.facebook,
      social?.linkedin,
      "contactbook.app",
    ),
    ...socialExtras,
    website: firstText(social?.website),
    linkedin: firstText(social?.linkedin),
    facebook: firstText(social?.facebook),
    instagram: firstText(customValue(social, "instagram")),
    themePrimary: card.theme?.primary ?? null,
  };
}
