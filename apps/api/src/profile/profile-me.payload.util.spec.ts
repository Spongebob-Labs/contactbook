import type { ProfileMePatchDto } from "./dto/profile-me-upsert.dto";
import { sanitizeProfilePayload } from "./profile-me.payload.util";

type SanitizeCase = [
  string,
  ProfileMePatchDto,
  (out: ProfileMePatchDto) => void,
];

describe("sanitizeProfilePayload", () => {
  it.each<SanitizeCase>([
    [
      "empty work array",
      { work: [] },
      (out) => expect(out.work).toBeUndefined(),
    ],
    [
      "empty personal shell",
      { personal: { tag: "", postalAddress: {} } },
      (out) => expect(out.personal).toBeUndefined(),
    ],
    [
      "personal null mobile clear",
      { personal: { mobile: null } },
      (out) => expect(out.personal).toEqual({ mobile: null }),
    ],
    [
      "empty financial object",
      {
        financial: {
          bankAccounts: [],
          digitalWallets: [],
          cryptoWallets: [],
        },
      },
      (out) => expect(out.financial).toBeUndefined(),
    ],
    [
      "work row with only empty strings",
      { work: [{ tag: "", companyName: "", workTitle: "" }] },
      (out) => expect(out.work).toBeUndefined(),
    ],
    [
      "social with empty custom values",
      { socials: [{ tag: "", custom: { skype: "" } }] },
      (out) => expect(out.socials).toBeUndefined(),
    ],
    [
      "personal postalAddress null clear",
      { personal: { postalAddress: null } },
      (out) => expect(out.personal).toEqual({ postalAddress: null }),
    ],
    [
      "one valid and one empty work row",
      {
        work: [
          { tag: "", companyName: "" },
          { tag: "Acme", companyName: "Acme Corp" },
        ],
      },
      (out) => {
        expect(out.work).toHaveLength(1);
        expect(out.work?.[0]).toMatchObject({
          tag: "Acme",
          companyName: "Acme Corp",
        });
      },
    ],
    [
      "valid bank account row",
      {
        financial: {
          bankAccounts: [
            {
              tag: "Bank",
              bankName: "HDFC",
              accountHolder: "Jane",
              accountNumber: "123",
              currency: "INR",
            },
          ],
        },
      },
      (out) => expect(out.financial?.bankAccounts).toHaveLength(1),
    ],
  ])("%s", (_label, input, assert) => {
    assert(sanitizeProfilePayload(input));
  });
});
