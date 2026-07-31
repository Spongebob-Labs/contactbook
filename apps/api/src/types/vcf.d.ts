declare module "vcf" {
  export class VCardProperty {
    type?: string | string[];
    value?: string;
    group?: string;
    [key: string]: unknown;
    valueOf(): string;
    isEmpty(): boolean;
    clone(): VCardProperty;
    toString(version?: string): string;
  }

  export class VCard {
    constructor();
    version: string;
    data: Record<string, VCardProperty | VCardProperty[] | undefined>;
    get(field: string): VCardProperty | VCardProperty[] | undefined;
    set(
      field: string,
      value: string | string[],
      params?: Record<string, unknown>,
    ): VCard;
    add(
      field: string,
      value: string | string[],
      params?: Record<string, unknown>,
    ): VCard;
    parse(value: string | Buffer): VCard;
    toString(version?: string): string;

    static parse(value: string | Buffer): VCard[];
    static normalize(input: string): string;
  }

  const vcf: typeof VCard;
  export default vcf;
}
