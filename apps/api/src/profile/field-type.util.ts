import { FieldType } from "@prisma/client";

/** Maps `JOB_TITLE` → `jobTitle`, `BANK_ACCOUNT` → `bankAccount`. */
export function fieldTypeToCamelCase(type: FieldType): string {
  const parts = type.split("_");
  return (
    parts[0]!.toLowerCase() +
    parts
      .slice(1)
      .map((s) => s.charAt(0) + s.slice(1).toLowerCase())
      .join("")
  );
}
