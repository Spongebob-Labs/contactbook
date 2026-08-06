import { Controller, Get, NotFoundException, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";

/**
 * Public (no-auth) endpoints for VCF delivery via WhatsApp.
 *
 * The challenge: WhatsApp opens template button URLs inside WKWebView (iOS) /
 * WebView (Android). These in-app browsers do NOT honour Content-Disposition:
 * attachment for text/* types, and ignore the <a download> attribute entirely.
 * Every "plain link to VCF" approach renders raw VCF text in the browser.
 *
 * Solution — three-layer approach:
 *  1. Web Share API  (iOS 15 / Android Chrome 86+) — opens the native OS share
 *     sheet with the VCF as a File object.  User picks Contacts → imported.
 *     Works inside WhatsApp's WKWebView/WebView because the share sheet is OS-
 *     level, not browser-level.
 *  2. text/x-vcard redirect fallback  — for browsers without Web Share API,
 *     navigate to /download/* which serves Content-Type: text/x-vcard (no
 *     Content-Disposition). Android WebView fires an implicit VIEW intent to
 *     Contacts; iOS Safari recognises the UTI and shows the import sheet.
 *  3. "Open in Safari" instructions  — shown as a fallback hint when neither
 *     of the above works; Safari reliably handles text/vcard natively.
 *
 * Routes:
 *  GET /api/v1/vcards/*            → HTML landing page (embeds VCF as base64)
 *  GET /api/v1/vcards/download/*   → raw VCF proxy (text/vcard)
 */
@Controller({ path: "vcards", version: "1" })
export class VcardDownloadController {
  constructor(private readonly config: ConfigService) {}

  /**
   * Proxies the VCF file for native OS contact import.
   *
   * MIME type: text/x-vcard (not text/vcard) — Android's Contacts app intent
   * filter registers text/x-vcard specifically. Using text/vcard (RFC 6350)
   * may not match the intent filter on older Android versions.
   *
   * NO Content-Disposition header: "attachment" tells the browser to download
   * the file rather than route it through the OS intent system. On Android
   * WebView, omitting Content-Disposition lets the WebView fire an implicit
   * android.intent.action.VIEW with type=text/x-vcard, which the Contacts app
   * handles. On iOS Safari, text/x-vcard is a known UTI (public.vcard) and
   * triggers the native "Add to Contacts" sheet inline.
   */
  @Get("download/*")
  async rawVcf(@Req() req: Request, @Res() res: Response) {
    const objectKey = this.extractKey(req, "/download/");
    if (!objectKey) throw new NotFoundException("Missing vcard key");

    const vcfText = await this.fetchVcf(objectKey);
    res.setHeader("Content-Type", "text/x-vcard; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(vcfText);
  }

  /** HTML landing page — the template button URL points here. */
  @Get("*")
  async page(@Req() req: Request, @Res() res: Response) {
    const objectKey = this.extractKey(req, "/");
    if (!objectKey) throw new NotFoundException("Missing vcard key");

    const vcfText = await this.fetchVcf(objectKey);
    const vcfB64 = Buffer.from(vcfText).toString("base64");
    const contactName = parseVcfName(vcfText);
    const contactPhone = parseVcfPhone(vcfText);

    const appPublicUrl = (
      this.config.get<string>("APP_PUBLIC_URL") ?? ""
    ).replace(/\/+$/, "");
    const downloadUrl = `${appPublicUrl}/api/v1/vcards/download/${objectKey}`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(buildPage(vcfB64, downloadUrl, contactName, contactPhone));
  }

  private extractKey(req: Request, afterSegment: string): string {
    const escaped = afterSegment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`/vcards${escaped}([^?#]+)`);
    return req.originalUrl.match(pattern)?.[1]?.replace(/\/+$/, "") ?? "";
  }

  private async fetchVcf(objectKey: string): Promise<string> {
    const baseUrl = (
      this.config.get<string>("GCS_CARD_SHARES_PUBLIC_BASE_URL") ?? ""
    ).replace(/\/+$/, "");
    const res = await fetch(`${baseUrl}/${objectKey}`);
    if (!res.ok) throw new NotFoundException("Contact card not found");
    return res.text();
  }
}

function parseVcfName(vcf: string): string {
  const fn = vcf.match(/^FN[;:](.+)$/m)?.[1]?.trim();
  if (fn) return fn;
  const n = vcf.match(/^N[;:](.+)$/m)?.[1]?.trim();
  if (n) {
    const parts = n.split(";").slice(0, 2).filter(Boolean).reverse();
    if (parts.length) return parts.join(" ");
  }
  return "Contact";
}

function parseVcfPhone(vcf: string): string {
  return vcf.match(/^TEL[^:]*:(.+)$/m)?.[1]?.trim() ?? "";
}

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

function buildPage(
  vcfB64: string,
  downloadUrl: string,
  contactName: string,
  contactPhone: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>Save ${esc(contactName)} – ContactBook</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100dvh;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 20px; padding: 32px 24px;
      background: #0a0a0a; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .logo { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; color: #ccc; }
    .logo span { color: #25D366; }
    .card {
      background: #151515; border-radius: 16px;
      padding: 24px 28px; text-align: center;
      width: 100%; max-width: 320px;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
    }
    .avatar {
      width: 64px; height: 64px; border-radius: 50%;
      background: #1e2d24; display: flex; align-items: center; justify-content: center;
      font-size: 28px; margin-bottom: 4px;
    }
    .name { font-size: 19px; font-weight: 600; }
    .phone { font-size: 14px; color: #888; }
    .btn {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      background: #25D366; color: #fff; border: none; cursor: pointer;
      border-radius: 50px; padding: 15px 32px;
      font-size: 16px; font-weight: 600;
      width: 100%; max-width: 320px;
      -webkit-tap-highlight-color: transparent;
      transition: opacity .15s;
    }
    .btn:active { opacity: 0.8; }
    .btn:disabled { opacity: 0.5; cursor: default; }
    .steps {
      display: none;
      background: #151515; border-radius: 12px;
      padding: 16px 20px; width: 100%; max-width: 320px;
    }
    .steps p { font-size: 13px; color: #aaa; margin-bottom: 10px; }
    .steps ol { padding-left: 18px; }
    .steps li { font-size: 13px; color: #ccc; line-height: 1.8; }
    .steps li strong { color: #fff; }
    .sub { font-size: 12px; color: #444; text-align: center; max-width: 280px; }
  </style>
</head>
<body>
  <div class="logo">Contact<span>Book</span></div>

  <div class="card">
    <div class="avatar">👤</div>
    <p class="name">${esc(contactName)}</p>
    ${contactPhone ? `<p class="phone">${esc(contactPhone)}</p>` : ""}
  </div>

  <button id="saveBtn" class="btn" onclick="saveContact(this)">
    &#11015;&nbsp; Save to Contacts
  </button>

  <!-- Shown after the share sheet fires on iOS -->
  <div class="steps" id="share-hint" style="display:none">
    <p>In the popup that just appeared:</p>
    <ol>
      <li>Scroll <strong>down</strong> past the app icons</li>
      <li>Tap <strong>Add to Contacts</strong></li>
    </ol>
  </div>

  <p class="sub" id="default-sub">Your phone will ask you to confirm.</p>

  <script>
    var DOWNLOAD_URL = '${downloadUrl}';
    var VCF_B64 = '${vcfB64}';

    var ua = navigator.userAgent;
    var isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    var isWhatsApp = /WhatsApp/.test(ua);

    async function saveContact(btn) {
      btn.disabled = true;
      btn.textContent = 'Opening\\u2026';

      if (isIOS && isWhatsApp) {
        // Web Share API with a VCF File object — iOS renders the share sheet for
        // the file. "Add to Contacts" appears in the ACTIONS list (scroll down past
        // the app icons row). One tap there imports the contact natively.
        try {
          var bytes = Uint8Array.from(atob(VCF_B64), function(c) { return c.charCodeAt(0); });
          var file = new File([bytes], 'contact.vcf', { type: 'text/x-vcard' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            document.getElementById('share-hint').style.display = 'block';
            document.getElementById('default-sub').style.display = 'none';
            await navigator.share({ files: [file] });
            btn.textContent = '\\u2713 Done!';
            return;
          }
        } catch(e) {
          if (e.name === 'AbortError') {
            btn.textContent = 'Save to Contacts';
            btn.disabled = false;
            return;
          }
        }
        // Web Share API not available — fall through to instructions.
        document.getElementById('share-hint').innerHTML =
          '<p>Tap <strong>&#8943;</strong> (top-right) &rarr; <strong>Open in Safari</strong>, then tap <strong>Save to Contacts</strong> again.</p>';
        document.getElementById('share-hint').style.display = 'block';
        document.getElementById('default-sub').style.display = 'none';
        btn.textContent = 'Save to Contacts';
        btn.disabled = false;
        return;
      }

      // Android WebView / iOS Safari: text/x-vcard fires the native Contacts handler.
      window.location.href = DOWNLOAD_URL;
      setTimeout(function() {
        btn.textContent = 'Save to Contacts';
        btn.disabled = false;
      }, 2000);
    }
  </script>
</body>
</html>`;
}
