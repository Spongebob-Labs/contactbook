import {
  __cryptoInternals,
  decryptOAuthTokenStored,
  encryptOAuthToken,
} from "./crypto.util";

describe("decryptOAuthTokenStored", () => {
  const priorKey = process.env.OAUTH_TOKEN_ENCRYPTION_KEY_BASE64;

  beforeAll(() => {
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY_BASE64 = Buffer.alloc(32, 7).toString(
      "base64",
    );
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
