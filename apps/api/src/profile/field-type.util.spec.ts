import { FieldType } from "@prisma/client";
import { fieldTypeToCamelCase } from "./field-type.util";

describe("fieldTypeToCamelCase", () => {
  it("maps JOB_TITLE to jobTitle", () => {
    expect(fieldTypeToCamelCase(FieldType.JOB_TITLE)).toBe("jobTitle");
  });

  it("maps BANK_ACCOUNT to bankAccount", () => {
    expect(fieldTypeToCamelCase(FieldType.BANK_ACCOUNT)).toBe("bankAccount");
  });

  it("maps SOCIAL_LINK to socialLink", () => {
    expect(fieldTypeToCamelCase(FieldType.SOCIAL_LINK)).toBe("socialLink");
  });
});
