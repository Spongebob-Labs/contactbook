/** Stable upsert key for ContactBook user-to-user shared contacts. */
export function contactbookUserExternalId(userId: string): string {
  return `contactbook:user:${userId}`;
}
