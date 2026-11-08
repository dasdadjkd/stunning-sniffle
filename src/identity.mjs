import crypto from 'node:crypto';
import fs from 'node:fs';

const FIRST_NAMES = [
  'Amelia', 'Noah', 'Olivia', 'Liam', 'Sophia', 'Ethan', 'Isabella', 'Mason',
  'Mia', 'Logan', 'Charlotte', 'Lucas', 'Harper', 'Elijah', 'Evelyn', 'Owen',
];
const LAST_NAMES = [
  'Bennett', 'Carter', 'Delgado', 'Ellison', 'Foster', 'Grant', 'Hayes',
  'Ingram', 'Jensen', 'Keller', 'Lambert', 'Mercer', 'Novak', 'Porter',
];
const SAFE_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

const pick = (list) => list[crypto.randomInt(0, list.length)];
const token = (length) =>
  Array.from({ length }, () => SAFE_ALPHABET[crypto.randomInt(0, SAFE_ALPHABET.length)]).join('');

export function makeIdentity({ emailDomain, password, workerId = 0 }) {
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  // Unique local part per run so mailbox polling cannot pick up another
  // worker's message.
  const tag = `${workerId}-${Date.now().toString(36).slice(-5)}-${token(4)}`;
  return {
    firstName,
    lastName,
    email: `${firstName.toLowerCase()}.${tag}@${emailDomain}`,
    password: password || `Qa-${token(12)}-${token(3)}!`,
  };
}

export function appendAccount(file, record) {
  fs.appendFileSync(file, `${JSON.stringify({ ...record, at: new Date().toISOString() })}\n`, {
    mode: 0o600,
  });
}
