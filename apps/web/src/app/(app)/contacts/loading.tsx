import { PageHeader } from "@/components/layout/page-header";

import { ContactsListSkeleton } from "./contacts-list-client";

/**
 * The route-level loading surface for `/contacts` (spec §6.1 R-14, §8D.1).
 *
 * **Layout-matched, never a spinner.** It renders the real page header — which never waited
 * for anything — above the exact bones `page.tsx` uses as its `<Suspense>` fallback: a
 * filter row and §8D.3's eight contact rows. Nothing moves when the data arrives, which is
 * the whole point of the family.
 *
 * A server component, deliberately. Nothing here reads `?state=`, and `loading.tsx` is a
 * Suspense fallback — the one place a needless client chunk would be paid for on every
 * navigation into this route.
 *
 * `ContactsListSkeleton` carries `data-screen-state="loading"` for the same reason every
 * other surface on this screen carries one: T29's sweeps key off that attribute and nothing
 * else (§13.2).
 */
export default function ContactsLoading() {
  return (
    <div className="flex flex-col gap-8 pb-16">
      <PageHeader
        title="Contacts"
        subtitle="Everyone who scanned one of your cards and saved their details back to you."
      />
      <ContactsListSkeleton />
    </div>
  );
}
