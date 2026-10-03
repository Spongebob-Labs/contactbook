import * as http2 from 'node:http2';

const APNS_HOST = 'https://api.push.apple.com';

export interface ApnsPushResult {
  ok: boolean;
  /** true when Apple says the token is dead (410 or BadDeviceToken) */
  tokenExpired: boolean;
  status?: number;
  body?: string;
}

/**
 * Sends an empty push notification to Apple's push gateway to tell iOS that a
 * pass has been updated. Uses HTTP/2 with TLS client certificate auth (the same
 * pass signing cert — no separate APNs key needed).
 *
 * Never include pushToken in log lines: it is a device credential.
 */
export async function sendApnsPush(
  pushToken: string,
  passTypeId: string,
  signerCertPem: string,
  signerKeyPem: string,
  signerKeyPassphrase: string | undefined,
): Promise<ApnsPushResult> {
  return new Promise((resolve) => {
    const client = http2.connect(APNS_HOST, {
      cert: signerCertPem,
      key: signerKeyPem,
      passphrase: signerKeyPassphrase,
    });

    client.on('error', (err) => {
      client.destroy();
      resolve({ ok: false, tokenExpired: false, body: err.message });
    });

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${pushToken}`,
      ':scheme': 'https',
      ':authority': 'api.push.apple.com',
      'apns-topic': passTypeId,
      'apns-push-type': 'background',
      'content-type': 'application/json',
      'content-length': '2',
    });

    req.end('{}');

    let statusCode = 0;
    req.on('response', (headers) => {
      statusCode = headers[':status'] as number;
    });

    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      client.close();
      const tokenExpired =
        statusCode === 410 ||
        (statusCode === 400 && body.includes('BadDeviceToken'));
      resolve({
        ok: statusCode === 200,
        tokenExpired,
        status: statusCode,
        body,
      });
    });

    req.on('error', (err) => {
      client.destroy();
      resolve({ ok: false, tokenExpired: false, body: err.message });
    });
  });
}
