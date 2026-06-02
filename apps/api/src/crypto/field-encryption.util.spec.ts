import {
  decryptFieldValue,
  decryptFieldValueIfNeeded,
  encryptFieldValue,
  isEncryptedFieldValue,
  parseFinancialEncryptionKeyBase64,
  __fieldCryptoInternals,
} from "./field-encryption.util";

const TEST_KEY = Buffer.alloc(32, 7);

describe("field-encryption.util", () => {
  beforeAll(() => {
    process.env.FINANCIAL_FIELD_ENCRYPTION_KEY_BASE64 =
      TEST_KEY.toString("base64");
    __fieldCryptoInternals.resetKeyCache();
  });

  afterAll(() => {
    delete process.env.FINANCIAL_FIELD_ENCRYPTION_KEY_BASE64;
    __fieldCryptoInternals.resetKeyCache();
  });

  it("round-trips plaintext", () => {
    const encrypted = encryptFieldValue("secret-account");
    expect(isEncryptedFieldValue(encrypted)).toBe(true);
    expect(decryptFieldValue(encrypted)).toBe("secret-account");
  });

  it("dual-read returns legacy plaintext", () => {
    expect(decryptFieldValueIfNeeded("plain-text")).toBe("plain-text");
  });

  it("parses key length", () => {
    expect(
      parseFinancialEncryptionKeyBase64(TEST_KEY.toString("base64")),
    ).toEqual(TEST_KEY);
  });
});
