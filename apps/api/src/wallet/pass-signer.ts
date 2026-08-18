import forge from "node-forge";

/**
 * How a pass gets signed.
 *
 * A `.pkpass` carries a PKCS#7 detached signature over `manifest.json`, made
 * with an Apple-issued Pass Type ID certificate and chained to Apple's WWDR
 * intermediate. iOS refuses anything else — there is no test mode and no
 * self-signed path on a real device.
 *
 * That key can never live in the browser, which is the single reason this part
 * of the product is server-side. It is behind an interface because the key's
 * home is expected to move: a hosted signing service today (no Apple account
 * yet), Shava Studios' own certificate for the prototype, and the client's
 * certificate before production. Each is a config change, not a rewrite.
 */
export interface PassSigner {
  /** Identifies which implementation is live, for logs and diagnostics. */
  readonly kind: "local-p12" | "hosted";
  sign(manifest: Buffer): Promise<Buffer>;
}

export type LocalSignerOptions = {
  /** Base64 of the Pass Type ID certificate exported as .p12 with its key. */
  p12Base64: string;
  p12Password: string;
  /** Apple WWDR intermediate, PEM. Free download from Apple. */
  wwdrPem: string;
};

export class LocalP12PassSigner implements PassSigner {
  readonly kind = "local-p12" as const;

  constructor(private readonly options: LocalSignerOptions) {}

  async sign(manifest: Buffer): Promise<Buffer> {
    const { certificate, privateKey } = this.loadIdentity();
    const wwdr = forge.pki.certificateFromPem(this.options.wwdrPem);

    const p7 = forge.pkcs7.createSignedData();
    // forge speaks binary strings, not Buffers.
    p7.content = forge.util.createBuffer(manifest.toString("binary"));
    p7.addCertificate(certificate);
    p7.addCertificate(wwdr);
    p7.addSigner({
      key: privateKey,
      certificate,
      digestAlgorithm: forge.pki.oids.sha256,
      // Apple requires signed attributes; a bare signature is rejected.
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime, value: new Date().toISOString() },
      ],
    });

    // Detached: the signature covers the manifest without embedding it.
    p7.sign({ detached: true });

    return Buffer.from(
      forge.asn1.toDer(p7.toAsn1()).getBytes(),
      "binary",
    );
  }

  private loadIdentity(): {
    certificate: forge.pki.Certificate;
    /**
     * Narrowed to RSA: forge types a bag key as a union that `addSigner` will
     * not accept, and Apple issues Pass Type ID certificates as RSA, so there
     * is no other case to handle here.
     */
    privateKey: forge.pki.rsa.PrivateKey;
  } {
    const der = forge.util.decode64(this.options.p12Base64);
    const asn1 = forge.asn1.fromDer(der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, this.options.p12Password);

    const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ]?.[0];
    const keyBag =
      p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
        forge.pki.oids.pkcs8ShroudedKeyBag
      ]?.[0] ??
      p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0];

    if (!certBag?.cert || !keyBag?.key) {
      throw new Error(
        "Pass certificate .p12 did not contain both a certificate and a private key.",
      );
    }

    return {
      certificate: certBag.cert,
      privateKey: keyBag.key as forge.pki.rsa.PrivateKey,
    };
  }
}

export type HostedSignerOptions = {
  /** Endpoint that accepts the manifest and returns a detached PKCS#7. */
  url: string;
  token: string;
};

/**
 * Signing via a third-party pass service (PassNinja, PassKit.com and similar),
 * which hold their own Apple certificates. This is the route while no Apple
 * Developer account exists — with the caveat that the pass is issued under
 * their entity and the manifest transits a third party, so it is for demos
 * with your own details, not real client contacts.
 */
export class HostedPassSigner implements PassSigner {
  readonly kind = "hosted" as const;

  constructor(private readonly options: HostedSignerOptions) {}

  async sign(manifest: Buffer): Promise<Buffer> {
    const response = await fetch(this.options.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.token}`,
      },
      body: JSON.stringify({ manifest: manifest.toString("base64") }),
    });

    if (!response.ok) {
      throw new Error(
        `Pass signing service responded ${response.status}.`,
      );
    }

    const payload = (await response.json()) as { signature?: string };
    if (!payload.signature) {
      throw new Error("Pass signing service returned no signature.");
    }

    return Buffer.from(payload.signature, "base64");
  }
}
