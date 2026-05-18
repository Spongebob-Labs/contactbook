import { FieldType } from "@prisma/client";
import {
  flattenFieldForContext,
  type FieldWithExtensions,
} from "./profile-me.flatten";
import { inflateWorkItem } from "./profile-me.inflate";

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
