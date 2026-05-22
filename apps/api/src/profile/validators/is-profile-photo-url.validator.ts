import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { normalizePublicBaseUrl } from "../../storage/gcs-profile-photo.service";

const DATA_URL_PREFIX = "data:image/";

export function getProfilePhotoUrlPrefix(): string | null {
  const base = process.env.GCS_PUBLIC_BASE_URL?.trim();
  if (!base) {
    return null;
  }
  return `${normalizePublicBaseUrl(base)}/`;
}

@ValidatorConstraint({ name: "isProfilePhotoUrl", async: false })
export class IsProfilePhotoUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value !== "string") {
      return false;
    }
    if (value.startsWith(DATA_URL_PREFIX)) {
      return false;
    }
    const prefix = getProfilePhotoUrlPrefix();
    if (!prefix) {
      return value.startsWith("https://");
    }
    return value.startsWith(prefix);
  }

  defaultMessage(): string {
    const prefix = getProfilePhotoUrlPrefix();
    if (prefix) {
      return `profilePhoto must be an HTTPS URL under ${prefix}`;
    }
    return "profilePhoto must be a valid HTTPS URL (data URLs are not allowed)";
  }
}

export function IsProfilePhotoUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsProfilePhotoUrlConstraint,
    });
  };
}
