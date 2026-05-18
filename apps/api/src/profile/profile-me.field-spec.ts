import { FieldType } from "@prisma/client";

export type AddressSpec = {
  street: string;
  city: string;
  state?: string | null;
  pincode?: string | null;
  country: string;
};

export type BankAccountSpec = {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  iban?: string | null;
  swiftBic?: string | null;
  routingNumber?: string | null;
  ifsc?: string | null;
  currency?: string;
};

export type DigitalWalletSpec = {
  platform: string;
  handleOrLink: string;
};

export type CryptoWalletSpec = {
  network: string;
  address: string;
};

/** Normalized field payload for persistence (inverse of flatten). */
export type FieldSpec = {
  type: FieldType;
  label?: string | null;
  value?: string | null;
  isSensitive?: boolean;
  address?: AddressSpec;
  bankAccount?: BankAccountSpec;
  digitalWallet?: DigitalWalletSpec;
  cryptoWallet?: CryptoWalletSpec;
};

export type InflatedGroupItem = {
  tag: string;
  groupId?: string;
  fields: FieldSpec[];
};

export type InflatedFinancialRow = {
  fieldId?: string;
  groupId?: string;
  tag: string;
  field: FieldSpec;
};
