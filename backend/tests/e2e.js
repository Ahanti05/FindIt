/**
 * End-to-end check of the whole FindIt flow against a running stack
 * (MongoDB + backend + AI service) seeded with `npm run seed -- --reset`.
 *
 *   npm run test:e2e              # uses http://localhost:5000
 *   E2E_URL=http://host:5000 npm run test:e2e
 *
 * It changes data (completes a claim, uploads a report), so re-seed before
 * running it again.
 */
const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');

const BASE = process.env.E2E_URL || 'http://localhost:5000';
const IMAGES = path.join(__dirname, '..', 'seed', 'images');
let passed = 0;
let failed = 0;

const check = (name, cond, extra = '') => {
  if (cond) { passed += 1; console.log(`  ok    ${name}`); } else { failed += 1; console.log(`  FAIL  ${name} ${extra}`); }
};

const call = async (method, url, { token, body, form } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}/api${url}`, { method, headers, body: form || (body && JSON.stringify(body)) });
  let data = null;
  try { data = await res.json(); } catch (_) { /* empty body */ }
  return { status: res.status, data };
};

const imageForm = (fields, fileField, fileName) => {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  if (fileName) {
    fd.append(fileField, new Blob([fs.readFileSync(path.join(IMAGES, fileName))], { type: 'image/jpeg' }), fileName);
  }
  return fd;
};

const login = async (email, password = 'Test@1234') => (await call('POST', '/auth/login', { body: { email, password } })).data.token;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`FindIt end-to-end check against ${BASE}\n`);

  console.log('Public endpoints');
  const health = await call('GET', '/health');
  check('API is up and DB connected', health.data?.db === 'connected');
  const meta = await call('GET', '/meta');
  check('meta lists 16 categories', meta.data?.categories?.length === 16);
  const ai = await call('GET', '/ai/status');
  check('AI service online', ai.data?.online === true);
  const stats = await call('GET', '/stats/public');
  check('public stats returned', typeof stats.data?.stats?.matches === 'number');
  const list = await call('GET', '/found-items?limit=50');
  check('found items list excludes embeddings', list.data.items.every((i) => !i.embedding?.vector));

  console.log('\nAuthentication & authorisation');
  check('protected route without token is 401', (await call('GET', '/matches/mine')).status === 401);
  check('wrong password is 401', (await call('POST', '/auth/login', { body: { email: 'priya@university.edu', password: 'nope' } })).status === 401);
  const [priya, rahul, security, admin] = await Promise.all([
    login('priya@university.edu'), login('rahul@university.edu'), login('security@university.edu'), login('admin@findit.campus', 'Admin@1234'),
  ]);
  check('all demo users can sign in', Boolean(priya && rahul && security && admin));
  const me = await call('GET', '/auth/me', { token: priya });
  check('/auth/me hides reset tokens', me.data.user.email === 'priya@university.edu' && !('passwordResetToken' in me.data.user));
  check('students cannot open admin stats', (await call('GET', '/admin/stats', { token: rahul })).status === 403);
  const selfAdmin = await call('POST', '/auth/register', { body: { name: 'Mallory', email: `mallory${Date.now()}@university.edu`, password: 'Password1', role: 'admin' } });
  check('registering as admin gives a student account', selfAdmin.data?.user?.role === 'student');

  console.log('\nSocket.IO');
  const anonymous = io(BASE, { auth: {}, transports: ['websocket'], reconnection: false });
  const anonResult = await new Promise((resolve) => {
    anonymous.on('connect', () => resolve('connected'));
    anonymous.on('connect_error', (e) => resolve(e.message));
  });
  anonymous.close();
  check('socket without token is rejected', anonResult === 'Authentication required', anonResult);
  const priyaSocket = io(BASE, { auth: { token: priya }, transports: ['websocket'], reconnection: false });
  await new Promise((resolve) => priyaSocket.on('connect', resolve));
  const received = [];
  priyaSocket.on('chat:message', (m) => received.push(m));

  console.log('\nAI matches');
  const mine = await call('GET', '/matches/mine', { token: priya });
  const idMatch = mine.data.matches.find((m) => m.lostItem.category === 'ID Card');
  check('owner sees the ID-card match the AI created', Boolean(idMatch), JSON.stringify(mine.data.matches.map((m) => m.lostItem.title)));
  check('match score is high for the same card', idMatch?.combinedScore >= 0.7, idMatch?.combinedScore);
  const securityMatches = await call('GET', '/matches/mine', { token: security });
  check('finder sees the same match', securityMatches.data.matches.some((m) => m._id === idMatch?._id));
  check('unrelated user cannot open the match', (await call('GET', `/matches/${idMatch._id}`, { token: rahul })).status === 403);
  check('chat is closed before the owner confirms', (await call('POST', `/matches/${idMatch._id}/messages`, { token: priya, body: { body: 'hi' } })).status === 400);
  check('owner cannot give a finder response', (await call('PATCH', `/matches/${idMatch._id}/respond`, { token: priya, body: { response: 'confirmed' } })).status === 400);
  check('finder confirms', (await call('PATCH', `/matches/${idMatch._id}/respond`, { token: security, body: { response: 'confirmed' } })).status === 200);
  const accepted = await call('PATCH', `/matches/${idMatch._id}/respond`, { token: priya, body: { response: 'interested' } });
  check('owner says it is theirs → accepted', accepted.data?.match?.status === 'accepted');

  console.log('\nChat');
  check('outsider cannot post', (await call('POST', `/matches/${idMatch._id}/messages`, { token: rahul, body: { body: 'hello' } })).status === 403);
  check('finder can post', (await call('POST', `/matches/${idMatch._id}/messages`, { token: security, body: { body: 'Your card is at the library desk.' } })).status === 201);
  await wait(300);
  check('owner received the message live over the socket', received.some((m) => m.message?.body === 'Your card is at the library desk.'));
  const msgs = await call('GET', `/matches/${idMatch._id}/messages`, { token: priya });
  check('message history is readable', msgs.data.messages.length >= 1);

  console.log('\nClaim, verification and handover');
  const statement = 'Roll number 21EE045, Electrical Engineering, valid till June 2027.';
  check('finder cannot file the claim', (await call('POST', '/recovery', { token: security, form: imageForm({ matchId: idMatch._id, ownershipStatement: statement }) })).status === 403);
  check('too-short statement rejected', (await call('POST', '/recovery', { token: priya, form: imageForm({ matchId: idMatch._id, ownershipStatement: 'mine' }) })).status === 400);
  const claim = await call('POST', '/recovery', { token: priya, form: imageForm({ matchId: idMatch._id, ownershipStatement: statement }, 'evidenceImages', 'idcard.jpg') });
  check('owner files a claim with an evidence photo', claim.status === 201 && claim.data.recovery.evidenceImages.length === 1, JSON.stringify(claim.data));
  const recId = claim.data.recovery._id;
  check('duplicate claim is refused', (await call('POST', '/recovery', { token: priya, form: imageForm({ matchId: idMatch._id, ownershipStatement: statement }) })).status === 409);
  check('outsider cannot read the claim', (await call('GET', `/recovery/${recId}`, { token: rahul })).status === 403);
  const finderView = await call('GET', `/recovery/${recId}`, { token: security });
  check('finder sees the statement but not the claimant email', finderView.data.recovery.ownershipStatement === statement && !finderView.data.recovery.claimant.email);
  check('claimant cannot approve their own claim', (await call('PATCH', `/recovery/${recId}/review`, { token: priya, body: { decision: 'approved', handoverLocation: 'x' } })).status === 403);
  check('approval needs a handover place', (await call('PATCH', `/recovery/${recId}/review`, { token: security, body: { decision: 'approved' } })).status === 400);
  check('finder approves', (await call('PATCH', `/recovery/${recId}/review`, { token: security, body: { decision: 'approved', handoverLocation: 'Library front desk' } })).status === 200);
  const finderAfter = await call('GET', `/recovery/${recId}`, { token: security });
  check('finder never sees the handover code', !finderAfter.data.recovery.handoverCode);
  const ownerView = await call('GET', `/recovery/${recId}`, { token: priya });
  const code = ownerView.data.recovery.handoverCode;
  check('owner gets a 6-digit handover code', /^\d{6}$/.test(code || ''));
  const wrong = code === '000000' ? '111111' : '000000';
  check('wrong code is refused', (await call('POST', `/recovery/${recId}/complete`, { token: security, body: { code: wrong } })).status === 400);
  const done = await call('POST', `/recovery/${recId}/complete`, { token: security, body: { code: `FINDIT:${recId}:${code}` } });
  check('QR payload completes the handover', done.data?.recovery?.status === 'completed', JSON.stringify(done.data));
  const lostAfter = await call('GET', `/lost-items/${idMatch.lostItem._id}`, { token: priya });
  const matchAfter = await call('GET', `/matches/${idMatch._id}`, { token: priya });
  check('lost report is now recovered', lostAfter.data.item.status === 'recovered');
  check('match is now verified', matchAfter.data.match.status === 'verified');

  console.log('\nReporting with a photo');
  const preview = await call('POST', '/ai/analyze', { token: rahul, form: imageForm({}, 'image', 'keys_b.jpg') });
  check('photo preview suggests "Keys"', preview.data?.data?.suggestedCategory === 'Keys', preview.data?.data?.suggestedCategory);
  check('future date rejected', (await call('POST', '/found-items', { token: rahul, form: imageForm({ title: 'x', category: 'Keys', building: 'Main Library', foundDate: '2099-01-01' }) })).status === 400);
  check('unknown category rejected', (await call('POST', '/found-items', { token: rahul, form: imageForm({ title: 'x', category: 'Spaceship', building: 'Main Library', foundDate: '2026-01-01' }) })).status === 400);
  check('malformed id is 400 not 500', (await call('GET', '/lost-items/not-an-id')).status === 400);
  const created = await call('POST', '/found-items', {
    token: rahul,
    form: imageForm({ title: 'Car key with red tag', category: 'Keys', building: 'Parking Area', foundDate: new Date().toISOString().slice(0, 10) }, 'image', 'keys_b.jpg'),
  });
  check('found report with photo created', created.status === 201);
  let status = 'pending';
  for (let i = 0; i < 30 && ['pending', 'processing'].includes(status); i += 1) {
    await wait(1000);
    status = (await call('GET', `/found-items/${created.data.item._id}`)).data.item.aiDetection.processingStatus;
  }
  check('AI processed the new report', status === 'done', status);

  console.log('\nModeration & admin');
  check('flag needs a reason', (await call('POST', `/found-items/${created.data.item._id}/flag`, { token: priya, body: {} })).status === 400);
  check('user can flag a listing', (await call('POST', `/found-items/${created.data.item._id}/flag`, { token: priya, body: { reason: 'Duplicate of another post' } })).status === 200);
  const queue = await call('GET', '/admin/pending', { token: admin });
  check('flagged listing is in the admin queue', queue.data.data.foundItems.some((i) => i._id === created.data.item._id));
  const adminStats = await call('GET', '/admin/stats', { token: admin });
  check('admin stats count the completed recovery', adminStats.data.data.overview.totalRecovered >= 2, adminStats.data.data.overview.totalRecovered);
  check('other users cannot delete the report', (await call('DELETE', `/found-items/${created.data.item._id}`, { token: priya })).status === 403);
  check('owner deletes their report', (await call('DELETE', `/found-items/${created.data.item._id}`, { token: rahul })).status === 200);

  console.log('\nPassword reset (dev mode, no SMTP)');
  const forgot = await call('POST', '/auth/forgot-password', { body: { email: 'meera@university.edu' } });
  const token = forgot.data.devResetUrl?.split('/').pop();
  check('dev reset link returned', Boolean(token));
  check('reset sets a new password', (await call('POST', `/auth/reset-password/${token}`, { body: { password: 'NewPass@123' } })).status === 200);
  check('can log in with the new password', Boolean(await login('meera@university.edu', 'NewPass@123')));
  check('reset link cannot be reused', (await call('POST', `/auth/reset-password/${token}`, { body: { password: 'Another@123' } })).status === 400);
  const meera = await login('meera@university.edu', 'NewPass@123');
  await call('PATCH', '/auth/password', { token: meera, body: { currentPassword: 'NewPass@123', newPassword: 'Test@1234' } });
  check('change password restores the demo password', Boolean(await login('meera@university.edu')));

  priyaSocket.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
