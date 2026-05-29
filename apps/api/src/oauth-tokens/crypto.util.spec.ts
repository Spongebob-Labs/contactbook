import {
  __cryptoInternals,
  decryptOAuthTokenStored,
  decryptOAuthTokenStoredWithKey,
  decryptOAuthTokenWithKey,
  encryptOAuthToken,
  encryptOAuthTokenWithKey,
  parseOAuthEncryptionKeyBase64,
} from "./crypto.util";

describe("decryptOAuthTokenStored", () => {
  const priorKey = process.env.OAUTH_TOKEN_ENCRYPTION_KEY_BASE64;

  beforeAll(() => {
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY_BASE64 = Buffer.alloc(
      32,
      7,
    ).toString("base64");
    __cryptoInternals.resetKeyCache();
  });

  afterAll(() => {
    if (priorKey === undefined) {
      delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY_BASE64;
    } else {
      process.env.OAUTH_TOKEN_ENCRYPTION_KEY_BASE64 = priorKey;
    }
    __cryptoInternals.resetKeyCache();
  });

  it("round-trips encrypted tokens", () => {
    const plain = "ya29.example-access-token";
    const stored = encryptOAuthToken(plain);
    expect(decryptOAuthTokenStored(stored)).toBe(plain);
  });

  it("returns legacy plaintext refresh tokens unchanged", () => {
    const legacy = "1//0gLegacyPlaintextRefreshToken";
    expect(decryptOAuthTokenStored(legacy)).toBe(legacy);
  });
});

describe("encryptOAuthTokenWithKey / decryptOAuthTokenWithKey", () => {
  const keyA = parseOAuthEncryptionKeyBase64(
    Buffer.alloc(32, 1).toString("base64"),
  );
  const keyB = parseOAuthEncryptionKeyBase64(
    Buffer.alloc(32, 2).toString("base64"),
  );

  it("round-trips with an explicit key", () => {
    const plain = "secret-refresh-token";
    const stored = encryptOAuthTokenWithKey(plain, keyA);
    expect(decryptOAuthTokenWithKey(stored, keyA)).toBe(plain);
  });

  it("does not decrypt ciphertext produced with a different key", () => {
    const stored = encryptOAuthTokenWithKey("token", keyA);
    expect(() => decryptOAuthTokenWithKey(stored, keyB)).toThrow();
  });

  it("decryptOAuthTokenStoredWithKey upgrades legacy plaintext read path", () => {
    const legacy = "plain-legacy-token";
    expect(decryptOAuthTokenStoredWithKey(legacy, keyA)).toBe(legacy);
  });
});
