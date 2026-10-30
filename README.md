# QBadge

QBadge is a live production post quantum staff and crew credential badge record tool for airports, ports and secure sites on the Quantova network. It proves the issue, assignment, checkpoint check, suspension and revocation of a badge, and it lets any third party confirm that history without trusting the party that created it.

QBadge proves records without disclosing them. Badge holder identities stay private on the systems of the party that holds them. Only a salted cryptographic commitment is written to the chain, and no personal detail is ever published. A holder is named only by a chain address.

## What it records

Each record is a signed envelope of one of five types.

1. issue, an issuer states the badge type, number, holder, role and expiry of a badge.
2. assign, an assigner records the duty or area the badge is assigned to.
3. check, a verifier records a checkpoint check of the badge at a named point.
4. suspend, the issuer suspends the badge and states why.
5. revoke, the issuer revokes the badge and states why.

Every record is signed with ML-DSA-65 under FIPS 204 by the party whose role it names, and each later record links to the one before it so the whole life of a badge forms a chain.

## Proving the time

A record on its own carries only the claim of its signer. Anchoring a record on the Quantova network through Qstamp adds a post quantum evidence anchor that fixes the latest moment the record existed, provable against the record and the signer by anyone, without claiming a regulated timestamp status that Quantova Inc does not hold.

## Install

```
npm install @quantovainc/qbadge
```

## Use

```js
const qbadge = require('@quantovainc/qbadge');

const issuer = qbadge.generateKey();
const holder = qbadge.generateKey();
const badge = qbadge.issue({
  key: issuer,
  badgeType: 'crew',
  badgeNo: 'CRW 0001',
  subject: qbadge.keyId(holder),
  role: 'Ramp Agent',
  validUntil: '2027-01-01T00:00:00.000Z',
  issuerLabel: 'Airport Pass Office',
});

const anchored = await qbadge.anchor(badge, { seed, index: 0, network: 'testnet' });
const result = await qbadge.verify(anchored[0], { type: 'issue', network: 'testnet' });
```

## What a record does not establish

1. It does not show that the stated facts are true. It shows only that the signer stated them and that the statement existed unchanged at a point in time.
2. It does not identify a natural person. The holder and the issuer are chain addresses, and linking an address to a person is a separate attestation held off the chain.
3. The labels are text written by the signer, they are not a verified identity.

## License

Apache-2.0 OR MIT
