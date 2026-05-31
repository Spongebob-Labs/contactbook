import { BadRequestException } from "@nestjs/common";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseUuidList(
  value: unknown,
  fieldName: string,
): string[] | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const raw =
    typeof value === "string"
      ? value.split(",")
      : Array.isArray(value)
        ? value.flatMap((v) =>
            typeof v === "string" ||
            typeof v === "number" ||
            typeof v === "boolean"
              ? String(v).split(",")
              : [],
          )
        : typeof value === "number" || typeof value === "boolean"
          ? [String(value)]
          : [];
  const ids = raw.map((s) => s.trim()).filter((s) => s.length > 0);
  for (const id of ids) {
    if (!UUID_RE.test(id)) {
      throw new BadRequestException(
        `Invalid UUID in ${fieldName}: ${id}. Omit ${fieldName} when not filtering, or pass comma-separated ids from GET /api/v1/contacts/tags or GET /api/v1/contacts/groups.`,
      );
    }
  }
  return ids.length > 0 ? ids : undefined;
}
