import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CardService } from "../card/card.service";
import { buildPassBundle, passInputFromSnapshot, type PassConfig } from "./pass-content";
import {
  HostedPassSigner,
  LocalP12PassSigner,
  type PassSigner,
} from "./pass-signer";
import { createZip } from "./zip-writer";

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cards: CardService,
  ) {}

  /**
   * Produce a signed `.pkpass` for one of the caller's cards.
   *
   * Requires the card to be published: the pass barcode is the public URL, and
   * issuing a pass whose QR resolves to nothing is worse than refusing.
   */
  async buildPass(
    userId: string,
    cardId: string,
  ): Promise<{ filename: string; bytes: Buffer }> {
    const passConfig = this.resolvePassConfig();
    const signer = this.resolveSigner();

    if (!passConfig || !signer) {
      // Deliberately explicit: this is the one feature gated on a real-world
      // dependency rather than on code, and a vague 500 would send whoever
      // hits it looking in the wrong place.
      throw new ServiceUnavailableException(
        "Apple Wallet passes are not configured yet. A Pass Type ID certificate is required before passes can be issued.",
      );
    }

    const card = await this.cards.getCard(userId, cardId);

    if (!card.slug || card.publishedSnapshot === null) {
      throw new BadRequestException(
        "Publish this card before adding it to Wallet.",
      );
    }

    const shareUrl = `${this.webBaseUrl()}/c/${card.slug}`;
    const input = passInputFromSnapshot(
      card.publishedSnapshot,
      card.slug,
      shareUrl,
    );

    const { files, manifest } = buildPassBundle(input, passConfig);
    const signature = await signer.sign(manifest);

    this.logger.log(
      `Issued Wallet pass for card=${cardId} slug=${card.slug} signer=${signer.kind}`,
    );

    return {
      filename: `${card.slug}.pkpass`,
      bytes: createZip([
        ...files,
        { name: "manifest.json", data: manifest },
        { name: "signature", data: signature },
      ]),
    };
  }

  /** True when a pass can actually be issued — drives the client's badge. */
  isConfigured(): boolean {
    return Boolean(this.resolvePassConfig() && this.resolveSigner());
  }

  private webBaseUrl(): string {
    return (
      this.config.get<string>("CARD_PUBLIC_BASE_URL") ??
      "https://www.getcontactbook.com"
    ).replace(/\/+$/, "");
  }

  private resolvePassConfig(): PassConfig | null {
    const passTypeIdentifier = this.config.get<string>(
      "APPLE_PASS_TYPE_IDENTIFIER",
    );
    const teamIdentifier = this.config.get<string>("APPLE_TEAM_IDENTIFIER");

    if (!passTypeIdentifier || !teamIdentifier) {
      return null;
    }

    return {
      passTypeIdentifier,
      teamIdentifier,
      organizationName:
        this.config.get<string>("APPLE_PASS_ORGANIZATION_NAME") ??
        "ContactBook",
    };
  }

  private resolveSigner(): PassSigner | null {
    // A local certificate wins when present; the hosted service is the
    // stand-in while no Apple Developer account exists.
    const p12Base64 = this.config.get<string>("APPLE_PASS_P12_BASE64");
    const p12Password = this.config.get<string>("APPLE_PASS_P12_PASSWORD");
    const wwdrPem = this.config.get<string>("APPLE_WWDR_PEM");

    if (p12Base64 && p12Password && wwdrPem) {
      return new LocalP12PassSigner({ p12Base64, p12Password, wwdrPem });
    }

    const url = this.config.get<string>("APPLE_PASS_SIGNING_URL");
    const token = this.config.get<string>("APPLE_PASS_SIGNING_TOKEN");

    if (url && token) {
      return new HostedPassSigner({ url, token });
    }

    return null;
  }
}
