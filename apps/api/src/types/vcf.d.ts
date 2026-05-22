declare module "vcf" {
  export interface VCardProperty {
    valueOf(): string;
    isEmpty?(): boolean;
    type?: string | string[];
    [key: string]: unknown;
  }

  export interface VCard {
    version: string;
    data: Record<string, VCardProperty | VCardProperty[] | undefined>;
    get(field: string): VCardProperty | VCardProperty[] | undefined;
  }

  export function parse(value: string | Buffer): VCard[];
  export function normalize(input: string): string;

  const vcf: {
    parse: typeof parse;
    normalize: typeof normalize;
  };

  export default vcf;
}
