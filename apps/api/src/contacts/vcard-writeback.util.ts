/** Patches an existing vCard string with ContactBook contact fields (write-back). */

function escapeVcardValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

function normalizeNewlines(data: string): string {
  return data.replace(/\r\n/g, "\n");
}

function stripProperties(data: string, property: string): string {
  const re = new RegExp(`^${property}(?:[;:].*)?$`, "gim");
  return data
    .split("\n")
    .filter((line) => !re.test(line.trim()))
    .join("\n");
}

function replaceProperty(data: string, property: string, line: string): string {
  const re = new RegExp(`^${property}(?:[;:].*)?$`, "im");
  if (re.test(data)) {
    return data.replace(re, line);
  }
  return data.replace(/\nEND:VCARD/i, `\n${line}\nEND:VCARD`);
}

function formatN(
  firstName: string | null,
  lastName: string | null,
): string | null {
  const family = lastName?.trim() ?? "";
  const given = firstName?.trim() ?? "";
  if (!family && !given) {
    return null;
  }
  return `N:${escapeVcardValue(family)};${escapeVcardValue(given)};;;`;
}

function formatFn(
  displayName: string | null,
  firstName: string | null,
  lastName: string | null,
): string | null {
  const fn =
    displayName?.trim() ||
    [firstName, lastName].filter(Boolean).join(" ").trim();
  if (!fn) {
    return null;
  }
  return `FN:${escapeVcardValue(fn)}`;
}

export function patchVcardFromContact(
  vcardData: string,
  contact: {
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    notes: string | null;
    phones: Array<{ value: string; label: string | null }>;
    emails: Array<{ value: string; label: string | null }>;
    organizations: Array<{
      companyName: string | null;
      title: string | null;
    }>;
  },
): string {
  let data = normalizeNewlines(vcardData);

  const fnLine = formatFn(
    contact.displayName,
    contact.firstName,
    contact.lastName,
  );
  const nLine = formatN(contact.firstName, contact.lastName);
  if (fnLine) {
    data = replaceProperty(data, "FN", fnLine);
  }
  if (nLine) {
    data = replaceProperty(data, "N", nLine);
  }

  data = stripProperties(data, "TEL");
  data = stripProperties(data, "EMAIL");
  data = stripProperties(data, "ORG");
  data = stripProperties(data, "NOTE");

  const insertLines: string[] = [];
  for (const phone of contact.phones) {
    const label = phone.label?.trim();
    const typePart = label
      ? `;TYPE=${escapeVcardValue(label.toUpperCase())}`
      : "";
    insertLines.push(`TEL${typePart}:${escapeVcardValue(phone.value)}`);
  }
  for (const email of contact.emails) {
    const label = email.label?.trim();
    const typePart = label
      ? `;TYPE=${escapeVcardValue(label.toUpperCase())}`
      : "";
    insertLines.push(`EMAIL${typePart}:${escapeVcardValue(email.value)}`);
  }
  for (const org of contact.organizations) {
    const company = org.companyName?.trim();
    const title = org.title?.trim();
    if (company || title) {
      insertLines.push(
        `ORG:${escapeVcardValue(company ?? "")};${escapeVcardValue(title ?? "")}`,
      );
    }
  }
  if (contact.notes?.trim()) {
    insertLines.push(`NOTE:${escapeVcardValue(contact.notes.trim())}`);
  }

  if (insertLines.length > 0) {
    data = data.replace(
      /\nEND:VCARD/i,
      `\n${insertLines.join("\n")}\nEND:VCARD`,
    );
  } else {
    data = data.replace(/\nEND:VCARD/i, "\nEND:VCARD");
  }

  return data;
}

export function buildIcloudResourceUrl(
  serverBase: string,
  externalIdPath: string,
): string {
  const path = externalIdPath.startsWith("/")
    ? externalIdPath
    : `/${externalIdPath}`;
  return new URL(path, serverBase).href;
}
