import { ApiError } from '../common/errors/api-error';
import {
  decryptFieldValue,
  encryptFieldValue,
  isFinancialFieldType,
} from '../crypto/field-encryption.util';

const DECRYPTION_FAILED_PLACEHOLDER = '[decryption failed — contact support]';

export interface PreparedFieldValue {
  value: string;
  isEncrypted: boolean;
}

/**
 * The one place that decides "does this field type get encrypted, and with
 * what". Shared by ProfileService (one field at a time) and
 * ProfileOnboardingService (many fields in one transaction) — extracted
 * before either wrote a second copy, since a fork here is exactly the kind
 * of thing that quietly drifts (one path encrypts DIGITAL_WALLET, the other
 * forgets to) and isn't caught until a security review much later.
 */
export function prepareFieldValueForWrite(
  fieldEncryptionKey: string | undefined,
  ids: { userId: string; fieldId: string; type: string },
  plaintext: string,
): PreparedFieldValue {
  if (!isFinancialFieldType(ids.type)) {
    return { value: plaintext, isEncrypted: false };
  }
  if (!fieldEncryptionKey) {
    throw ApiError.conflict(
      'FIELD_ENCRYPTION_NOT_CONFIGURED',
      'Financial field types require FIELD_ENCRYPTION_KEY to be configured.',
    );
  }
  return {
    value: encryptFieldValue(fieldEncryptionKey, ids, plaintext),
    isEncrypted: true,
  };
}

/**
 * Decrypts for the owner's own read, never throwing into the caller — a
 * single corrupted or unrotated row must not fail a whole profile list.
 * Takes a logger callback rather than an AppLogger instance so this stays a
 * plain function usable from any service without a DI dependency.
 */
export function decryptFieldValueForRead(
  fieldEncryptionKey: string | undefined,
  ids: { userId: string; fieldId: string; type: string },
  storedValue: string,
  isEncrypted: boolean,
  onError: (err: unknown) => void,
): string {
  if (!isEncrypted) return storedValue;
  try {
    if (!fieldEncryptionKey)
      throw new Error('FIELD_ENCRYPTION_KEY not configured');
    return decryptFieldValue(fieldEncryptionKey, ids, storedValue);
  } catch (err) {
    onError(err);
    return DECRYPTION_FAILED_PLACEHOLDER;
  }
}
