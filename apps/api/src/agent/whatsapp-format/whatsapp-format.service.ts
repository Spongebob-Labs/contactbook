import { Injectable } from '@nestjs/common';

/**
 * Deterministic markdown → WhatsApp formatter.
 *
 * The agent's synthesiser is told to respond in GitHub-flavored markdown.
 * This module then converts that markdown to WhatsApp's flavor:
 *   **bold**   → *bold*
 *   *italic*   → _italic_       (also _italic_ → _italic_)
 *   # heading  → *Heading*
 *   - item     → • item
 *   [text](u)  → text (u)       (WhatsApp previews raw URLs only)
 *   > quote    → ❝ text
 *   ```lang    → ```           (mono block; language tag dropped)
 *   tables     → flattened bullet list
 *   HTML       → stripped
 *
 * Long replies are chunked on paragraph boundaries so a 4k-char reply
 * becomes 3 sequential WhatsApp messages rather than a truncated blob.
 * Each chunk is rendered with WhatsApp's quoting helpers ("(cont.)",
 * "(end)") on internal chunks so the user knows it's a series.
 */
@Injectable()
export class WhatsappFormatService {
  /**
   * Format markdown into an array of WhatsApp-ready messages, each
   * under `maxChunkChars`. Hard cap: if a single paragraph exceeds
   * the cap, it is hard-split at the cap.
   */
  format(markdown: string, maxChunkChars = 1400): string[] {
    if (!markdown) return [];
    const wa = this.markdownToWhatsapp(markdown).trim();
    if (wa.length <= maxChunkChars) return [wa];

    const paragraphs = wa.split(/\n{2,}/);
    const chunks: string[] = [];
    let buf = '';
    for (const p of paragraphs) {
      const piece = p.trim();
      if (!piece) continue;
      if (piece.length > maxChunkChars) {
        // Flush buf first, then hard-split this oversize paragraph.
        if (buf) {
          chunks.push(buf.trim());
          buf = '';
        }
        for (let i = 0; i < piece.length; i += maxChunkChars) {
          chunks.push(piece.slice(i, i + maxChunkChars));
        }
        continue;
      }
      const candidate = buf ? `${buf}\n\n${piece}` : piece;
      if (candidate.length > maxChunkChars) {
        chunks.push(buf.trim());
        buf = piece;
      } else {
        buf = candidate;
      }
    }
    if (buf) chunks.push(buf.trim());

    // Annotate middle + last chunk so the user can see the series.
    if (chunks.length > 1) {
      const last = chunks.length - 1;
      chunks[last] = `${chunks[last]}\n\n— (end)`;
      for (let i = 1; i < last; i++) {
        chunks[i] = `${chunks[i]}\n\n— (cont.)`;
      }
    }
    return chunks;
  }

  /** Format and assert a single message (throws if it would need chunking). */
  formatSingle(markdown: string, maxChars = 1400): string {
    const out = this.format(markdown, maxChars);
    if (out.length !== 1) {
      throw new Error(
        `formatSingle: expected 1 chunk, got ${out.length}. Use format() for multi-message replies.`,
      );
    }
    return out[0];
  }

  // -----------------------------------------------------------------------
  // The actual markdown → WhatsApp conversion. Pure function; the
  // service is a thin wrapper so it can be DI-injected everywhere and
  // unit-tested in isolation.
  // -----------------------------------------------------------------------

  private markdownToWhatsapp(input: string): string {
    let s = input;

    // 1. Strip raw HTML.
    s = s.replace(/<[^>]+>/g, '');

    // 2. Fenced code blocks: drop the language tag, keep the content.
    s = s.replace(/```[a-zA-Z0-9_+-]*\n([\s\S]*?)```/g, (_m, body) => {
      return '```\n' + body.replace(/\n+$/, '') + '\n```';
    });

    // 3. Tables (GFM): flatten to a bullet list of "Header: value" rows.
    s = s.replace(/^\|(.+)\|\s*\n\|[-:\s|]+\|\s*\n((?:\|.*\|\s*\n?)*)/gm, (_m, headerRow: string, bodyRows: string) => {
      const headers = headerRow.split('|').map((h) => h.trim()).filter(Boolean);
      const rows = bodyRows.trim().split('\n').map((r) => r.split('|').map((c) => c.trim()));
      const lines: string[] = [];
      for (const r of rows) {
        const pairs = headers
          .map((h, i) => (r[i] ? `${h}: ${r[i]}` : null))
          .filter((x): x is string => !!x);
        if (pairs.length) lines.push('• ' + pairs.join(' · '));
      }
      return lines.join('\n');
    });

    // 4. Headings → bold line.
    s = s.replace(/^#{1,6}\s+(.+)$/gm, (_m, t: string) => `*${t.trim()}*`);

    // 5. Bold + italic. Order matters: ** before *.
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '*$1*');     // **bold** → *bold*
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1_$2_'); // *italic* → _italic_  (avoid **)
    s = s.replace(/__([^_\n]+)__/g, '*$1*');         // __bold__ → *bold*
    s = s.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1_$2_'); // _italic_ stays _italic_

    // 6. Links: [text](url) → text (url)
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)');

    // 7. Unordered list bullets: - or * at line start → •
    s = s.replace(/^\s*[-*]\s+/gm, '• ');

    // 8. Blockquotes: > foo → ❝ foo
    s = s.replace(/^>\s?(.+)$/gm, '❝ $1');

    // 9. Collapse 3+ blank lines to 2.
    s = s.replace(/\n{3,}/g, '\n\n');

    return s;
  }
}
