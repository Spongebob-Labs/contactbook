import { ContactBackLink, ContactDetailSkeleton } from "./contact-detail-client";

/**
 * The route-level loading surface for `/contacts/[contactId]` (spec §6.1 R-15, §8D.1).
 *
 * §8D.3's contact-detail loading row is **identity + field skeletons**, and that is exactly
 * what renders here — in the same two-column box the real screen occupies, under the same
 * back link, which never waited for anything. Layout-matched, never a spinner: nothing moves
 * when the contact arrives.
 *
 * A server component, deliberately. Nothing here reads `?state=`, and `loading.tsx` is a
 * Suspense fallback — the one place a needless client chunk would be paid for on every
 * navigation into this route.
 */
export default function ContactDetailLoading() {
  return (
    <div className="flex flex-col gap-8 pb-16">
      <ContactBackLink />
      <ContactDetailSkeleton />
    </div>
  );
}
