// Copyright 2026 Quantova Inc
// SPDX-License-Identifier: Apache-2.0 OR MIT

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Q = require('..');

function freshKey() {
  return Q.generateKey();
}

function issueBadge(key, subject) {
  return Q.issue({ key, badgeType: 'crew', badgeNo: 'CRW 0001', subject: Q.keyId(subject), role: 'Ramp Agent', validUntil: '2027-01-01T00:00:00.000Z', issuerLabel: 'Pass Office' });
}

test('an issued badge is a well formed signed record of the issuer', () => {
  const issuer = freshKey();
  const holder = freshKey();
  const b = issueBadge(issuer, holder);
  assert.strictEqual(b.format, 'qbadge/1');
  assert.strictEqual(b.type, 'issue');
  assert.strictEqual(b.algorithm, 'ML-DSA-65');
  assert.strictEqual(b.signer.id, Q.keyId(issuer));
  assert.strictEqual(b.statement.issuerKeyId, Q.keyId(issuer));
  assert.strictEqual(b.statement.subjectKeyId, Q.keyId(holder));
  assert.match(b.statement.badgeId, /^[0-9a-f]{32}$/);
  assert.strictEqual(Buffer.from(b.signature, 'base64').length, Q.SIGNATURE_BYTES);
});

test('the assign, check and suspend records chain to the same badge', () => {
  const issuer = freshKey();
  const holder = freshKey();
  const assigner = freshKey();
  const verifier = freshKey();
  const b = issueBadge(issuer, holder);
  const as = Q.assign({ key: assigner, badge: b, assignment: 'Apron North' });
  const ck = Q.check({ key: verifier, record: b, point: 'Gate C checkpoint' });
  const sp = Q.suspend({ key: issuer, record: ck, reason: 'lost badge' });
  assert.strictEqual(as.statement.badgeId, b.statement.badgeId);
  assert.strictEqual(as.statement.issueRef, Q.recordRef(b));
  assert.strictEqual(ck.statement.priorRef, Q.recordRef(b));
  assert.strictEqual(sp.statement.priorRef, Q.recordRef(ck));
});

test('invalid inputs are refused before anything is signed', () => {
  const key = freshKey();
  const holder = freshKey();
  const base = { key, badgeType: 'crew', badgeNo: 'B1', subject: Q.keyId(holder), role: 'Agent', validUntil: '2027-01-01T00:00:00.000Z' };
  assert.throws(() => Q.issue(Object.assign({}, base, { badgeType: 'vip' })), /badgeType must be one of/);
  assert.throws(() => Q.issue(Object.assign({}, base, { badgeNo: '' })), /badgeNo is 1 to/);
  assert.throws(() => Q.issue(Object.assign({}, base, { role: '' })), /role cannot be empty/);
  assert.throws(() => Q.issue(Object.assign({}, base, { subject: 'nothex' })), /subject is a/);
  assert.throws(() => Q.issue(Object.assign({}, base, { unknownField: 1 })), /is not an option of issue/);
});

test('a signing key must be a well formed 32 byte seed', () => {
  const holder = freshKey();
  assert.throws(() => issueBadge(new Uint8Array(16), holder), /32 byte Uint8Array seed/);
  assert.throws(() => issueBadge(new Uint8Array(32), holder), /too few different byte values/);
});

test('a well formed record verifies and a type mismatch is invalid', async () => {
  const issuer = freshKey();
  const holder = freshKey();
  const b = issueBadge(issuer, holder);
  const ok = await Q.verify(b, { type: 'issue', network: 'testnet', requireAnchor: false, strict: false });
  assert.strictEqual(ok.status, 'valid');
  assert.strictEqual(ok.type, 'issue');
  assert.strictEqual(ok.badgeId, b.statement.badgeId);
  const wrongType = await Q.verify(b, { type: 'check', network: 'testnet', requireAnchor: false, strict: false });
  assert.strictEqual(wrongType.status, 'invalid');
  const wrongSigner = await Q.verify(b, { type: 'issue', network: 'testnet', requireAnchor: false, strict: false, signerKeyId: Q.keyId(freshKey()) });
  assert.strictEqual(wrongSigner.status, 'invalid');
});

test('a tampered statement no longer verifies', async () => {
  const issuer = freshKey();
  const holder = freshKey();
  const b = issueBadge(issuer, holder);
  const forged = JSON.parse(JSON.stringify(b));
  forged.statement.role = 'Captain';
  const r = await Q.verify(forged, { type: 'issue', network: 'testnet', requireAnchor: false, strict: false });
  assert.strictEqual(r.status, 'invalid');
  assert.ok(r.checks.some((c) => c.name === 'signature' && !c.ok));
});

test('the prior link binds a check to the badge it refers to', async () => {
  const issuer = freshKey();
  const holder = freshKey();
  const verifier = freshKey();
  const b = issueBadge(issuer, holder);
  const ck = Q.check({ key: verifier, record: b, point: 'Gate C' });
  const good = await Q.verify(ck, { type: 'check', network: 'testnet', requireAnchor: false, strict: false, prior: b });
  assert.ok(good.checks.some((c) => c.name === 'prior' && c.ok));
  const otherB = issueBadge(issuer, holder);
  const bad = await Q.verify(ck, { type: 'check', network: 'testnet', requireAnchor: false, strict: false, prior: otherB });
  assert.strictEqual(bad.status, 'invalid');
  assert.ok(bad.checks.some((c) => c.name === 'prior' && !c.ok));
});

test('subjectRef is deterministic for the same secret and reference and differs otherwise', () => {
  const secret = new Uint8Array(32);
  globalThis.crypto.getRandomValues(secret);
  const a = Q.subjectRef(secret, 'CRW 0001');
  const b = Q.subjectRef(secret, 'CRW 0001');
  const c = Q.subjectRef(secret, 'CRW 0002');
  assert.strictEqual(a, b);
  assert.notStrictEqual(a, c);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test('the kind and constants are the ones pinned for the badge line', () => {
  assert.strictEqual(Q.KIND, 1508);
  assert.strictEqual(Q.FORMAT, 'qbadge/1');
  assert.deepStrictEqual([...Q.TYPES], ['issue', 'assign', 'check', 'suspend', 'revoke']);
  assert.deepStrictEqual([...Q.BADGETYPES], ['staff', 'crew', 'contractor', 'visitor', 'press']);
});
