/**
 * A stand-in for the public share-link API, for the e2e suite only.
 *
 * Covers three operations, all of them `@ApiExcludeController()` on the real API:
 *   · `GET  /api/v1/public/links/{token}`
 *   · `POST /api/v1/public/links/{token}/connect/otp/request`
 *   · `POST /api/v1/public/links/{token}/connect/otp/verify`
 *
 * ## Why this exists
 * `/c/[slug]` resolves its card **server-side**, inside the Next process — so
 * `page.route()` cannot intercept it, and the suite has no way to put a card of a
 * known shape on screen. When the route moved from fixtures to the real API, every
 * test in `public-card.spec.ts` started navigating to slugs that resolve to nothing.
 * They did not fail loudly; they just stopped exercising the page. That is how the
 * `f3b09a4` ground regression — the background painting only as tall as the card's
 * content — shipped and stayed shipped.
 *
 * ## The token vocabulary
 * `n{count}` renders a card carrying exactly that many fields, so a test can address
 * "the shortest article this route can produce" (`n0`) as directly as a full one.
 * Nothing here is a fixture of a real person: the name is the product's own demo
 * identity and every value is synthetic.
 *
 * ## The code vocabulary, and why the outcome rides on the code rather than the token
 * "Save & connect" has eight documented failure codes and every one of them needs to be
 * reachable from a page that **rendered** — so the token cannot carry the error, or there
 * would be no card on screen to run the flow on. The six-digit code the test types decides
 * the outcome instead:
 *
 *   · `424242` → 200 `{connected:true}`, the happy path
 *   · `000000` → 409 `OTP_INVALID`            (retryable — the input stays live)
 *   · `111111` → 409 `OTP_ATTEMPTS_EXCEEDED`  (this code is dead; resend is the only way on)
 *   · `222222` → 404 `OTP_NOT_FOUND`          (expired, same)
 *   · `333333` → 409 `CANNOT_CONNECT_TO_SELF` (the owner's own number)
 *
 * ⚠ `devCode` is `424242` on every request, which is what makes the happy path typeable
 * without reading a WhatsApp message. The real API only ever sends it outside production.
 *
 * The request step keys off the **phone** for the same reason, since no code exists yet:
 * a national number ending `99` gets `OTP_COOLDOWN` with a `retryAfterSeconds` of 42, and
 * one ending `98` gets `OTP_RATE_LIMITED`, which carries no retry hint.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.STUB_API_PORT ?? 8788);

/** The code the stub "sends", and the only one that connects. */
const DEV_CODE = "424242";

/** `code` → the envelope `POST …/otp/verify` answers with. `null` means success. */
const VERIFY_OUTCOMES = {
  [DEV_CODE]: null,
  "000000": [409, "OTP_INVALID", "That code is incorrect."],
  "111111": [409, "OTP_ATTEMPTS_EXCEEDED", "Too many incorrect attempts."],
  "222222": [404, "OTP_NOT_FOUND", "No active code for this number."],
  "333333": [409, "CANNOT_CONNECT_TO_SELF", "You can't connect to your own card."],
};

const field = (i) => ({
  type: "CUSTOM",
  label: `Field ${i + 1}`,
  value: `value-${i + 1}`,
});

function cardBody(count) {
  return {
    owner: { name: "Priyanka Raghunathan", photoUrl: null },
    card: {
      name: "Work",
      kind: "WORK",
      templateId: "meridian",
      paletteId: "emerald",
      groundHex: null,
      finish: "gradient",
      texture: "grid",
      texturePresence: "subtle",
      textureScale: "regular",
      updatedAt: "2026-08-23T18:00:00.000Z",
    },
    fields: Array.from({ length: count }, (_, i) => field(i)),
  };
}

/** The API's error envelope. `requestId` is present on every real one, so it is present here. */
function fail(res, status, code, message, details) {
  res.statusCode = status;
  res.end(
    JSON.stringify({
      statusCode: status,
      code,
      message,
      requestId: "stub-request-id",
      ...(details === undefined ? {} : { details }),
    }),
  );
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

const server = createServer((req, res) => {
  void handle(req, res).catch(() => {
    if (!res.writableEnded) fail(res, 500, "UNKNOWN", "Stub failed.");
  });
});

async function handle(req, res) {
  const url = req.url ?? "";
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-request-id", "stub-request-id");

  /* ⚠ The connect routes are matched FIRST, and this order is the whole correctness of this
     file. `/public/links/n5/connect/otp/request` also matches the card pattern below — `\b`
     is satisfied by the `/` after the token — so a card payload was being returned with a 200
     for both POSTs. The flow appeared to work: `sent` was undefined, `devCode` was undefined,
     and the UI advanced to the code step having sent nothing. A stub that answers the wrong
     operation successfully is worse than one that 404s. */
  const connect = /\/public\/links\/(n\d+)\/connect\/otp\/(request|verify)\b/.exec(url);
  if (connect !== null) {
    if (req.method !== "POST") {
      return fail(res, 404, "NOT_FOUND", `Cannot ${req.method} ${url}`);
    }

    const body = await readJson(req);
    const phone = typeof body.phoneE164 === "string" ? body.phoneE164 : "";

    if (connect[2] === "request") {
      if (phone.endsWith("99")) {
        return fail(res, 409, "OTP_COOLDOWN", "Please wait before requesting another code.", {
          retryAfterSeconds: 42,
        });
      }
      if (phone.endsWith("98")) {
        return fail(res, 409, "OTP_RATE_LIMITED", "Too many codes requested for this number.");
      }
      res.statusCode = 202;
      return res.end(JSON.stringify({ sent: true, devCode: DEV_CODE }));
    }

    const code = typeof body.code === "string" ? body.code : "";
    const outcome = VERIFY_OUTCOMES[code];
    // An unlisted code behaves like any wrong one, so a typo in a test reads as a wrong code
    // rather than as a pass.
    if (outcome === undefined) {
      return fail(res, 409, "OTP_INVALID", "That code is incorrect.");
    }
    if (outcome !== null) {
      return fail(res, outcome[0], outcome[1], outcome[2]);
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ connected: true }));
  }

  const match = /\/public\/links\/n(\d+)\b/.exec(url);
  if (match === null) {
    return fail(res, 404, "SHARE_LINK_NOT_FOUND", "This link does not exist.");
  }

  res.end(JSON.stringify(cardBody(Number(match[1]))));
}

server.listen(PORT, () => console.log(`public-card stub api on ${PORT}`));
