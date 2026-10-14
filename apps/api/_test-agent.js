require('dotenv').config();
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signJwt(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest();
  return `${header}.${body}.${b64url(sig)}`;
}

(async () => {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!user) { console.log('NO USER'); return; }
  console.log('user:', user.id, user.phoneE164);

  // Sign a JWT just like JwtService does (sub = user.id, phoneE164 = phone).
  const token = signJwt(
    { sub: user.id, phoneE164: user.phoneE164, iat: Math.floor(Date.now()/1000) },
    process.env.JWT_ACCESS_SECRET,
  );

  // Find or create a thread for this user.
  const thread = await prisma.chatThread.findFirst({
    where: { userId: user.id, archivedAt: null },
    orderBy: { updatedAt: 'desc' },
  });
  let threadId;
  if (thread) {
    threadId = thread.id;
  } else {
    const t = await prisma.chatThread.create({
      data: { userId: user.id, langgraphThreadId: crypto.randomUUID() },
    });
    threadId = t.id;
  }
  console.log('threadId:', threadId);

  const BASE = 'http://localhost:8000/api/v1';
  const t0 = Date.now();
  const resp = await fetch(`${BASE}/agent/threads/${threadId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'what is in my profile' }),
  });
  const t1 = Date.now();
  const body = await resp.json();
  console.log('status:', resp.status);
  console.log('wall time (ms):', t1 - t0);
  console.log('reported durationMs:', body.durationMs);
  console.log('finalAnswer:', JSON.stringify(body.finalAnswer));
  console.log('interrupt:', body.interrupt);
  console.log('message roles:', body.messages?.map(m => m.role));
  console.log('tool call count:', body.toolResults?.length);
  console.log('tool call names:', body.toolResults?.map(t => `${t.name}#${t.toolCallId}`));

  await prisma.$disconnect();
})();
