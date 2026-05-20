import { FieldType } from "@prisma/client";
import {
  flattenFieldForContext,
  type FieldWithExtensions,
} from "./profile-me.flatten";
import { inflateSocialItem, inflateWorkItem } from "./profile-me.inflate";

function mkField(
  partial: Partial<FieldWithExtensions> & Pick<FieldWithExtensions, "type">,
): FieldWithExtensions {
  const now = new Date();
  return {
    id: "f1",
    groupId: "g1",
    label: null,
    isSensitive: false,
    value: null,
    createdAt: now,
    updatedAt: now,
    address: null,
    bankAccount: null,
    digitalWallet: null,
    cryptoWallet: null,
    ...partial,
  };
}

describe("inflateWorkItem", () => {
  it("maps workTitle to JOB_TITLE", () => {
    const item = inflateWorkItem({
      tag: "Acme",
      workTitle: "Engineer",
      companyName: "Acme Inc",
    });
    expect(
      item.fields.some(
        (f) => f.type === FieldType.JOB_TITLE && f.value === "Engineer",
      ),
    ).toBe(true);
    expect(
      item.fields.some(
        (f) => f.type === FieldType.COMPANY && f.value === "Acme Inc",
      ),
    ).toBe(true);
  });

  it("round-trips JOB_TITLE through flatten", () => {
    const field = mkField({ type: FieldType.JOB_TITLE, value: "Architect" });
    const flat = flattenFieldForContext(field, "work");
    const item = inflateWorkItem({ tag: "Co", ...flat });
    expect(item.fields.find((f) => f.type === FieldType.JOB_TITLE)?.value).toBe(
      "Architect",
    );
  });
});

describe("inflateSocialItem", () => {
  it("maps top-level skype and whatsApp to SOCIAL_LINK fields", () => {
    const item = inflateSocialItem({
      tag: "Social",
      skype: "live:user",
      whatsApp: "+12025551234",
      custom: { GitHub: "https://github.com/example" },
    });
    expect(
      item.fields.some(
        (f) =>
          f.type === FieldType.SOCIAL_LINK &&
          f.label === "skype" &&
          f.value === "live:user",
      ),
    ).toBe(true);
    expect(
      item.fields.some(
        (f) =>
          f.type === FieldType.SOCIAL_LINK &&
          f.label === "whatsapp" &&
          f.value === "+12025551234",
      ),
    ).toBe(true);
    expect(
      item.fields.some(
        (f) => f.type === FieldType.CUSTOM && f.label === "GitHub",
      ),
    ).toBe(true);
  });
});
