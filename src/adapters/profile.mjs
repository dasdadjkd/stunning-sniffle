import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A profile is a JSON file describing one deployment's flow:
 *
 *   { "routes": { "signup": "/signup", "afterSignup": "check-?email" },
 *     "selectors": { "email": { "labelPattern": "e-?mail" } },
 *     "card": { "number": "4242..." } }
 *
 * Strings in `routes` and any `*Pattern` selector field are compiled to
 * RegExp, so `"check-?email"` matches both `/check-email` and `/checkemail`.
 */
const ROUTE_KEYS = ['signup', 'afterSignup', 'afterVerify', 'plan', 'upgrade'];
const LOCATOR_FIELDS = [
  'role',
  'label',
  'labelPattern',
  'placeholder',
  'placeholderPattern',
  'name',
  'namePattern',
];

const compile = (value) => (typeof value === 'string' ? new RegExp(value, 'i') : value);

export function compileRoutes(routes = {}) {
  const out = {};
  for (const key of ROUTE_KEYS) {
    if (routes[key] === undefined || routes[key] === null) continue;
    out[key] = key === 'signup' ? routes[key] : compile(routes[key]);
  }
  return out;
}

export function compileSelectors(selectors = {}) {
  const out = {};
  for (const [field, spec] of Object.entries(selectors)) {
    if (spec === false || spec === null) {
      out[field] = null;
      continue;
    }
    const compiled = {};
    for (const key of LOCATOR_FIELDS) {
      if (spec[key] === undefined) continue;
      compiled[key] = key.endsWith('Pattern') ? compile(spec[key]) : spec[key];
    }
    if (spec.exact) compiled.exact = true;
    if (!compiled.role && !compiled.label && !compiled.labelPattern && !compiled.placeholder && !compiled.placeholderPattern) {
      throw new Error(`profile selector "${field}" needs a label, role or placeholder`);
    }
    out[field] = compiled;
  }
  return out;
}

/** Reads and compiles a profile file. Throws with the path so the fix is obvious. */
export function loadProfile(file) {
  const resolved = file instanceof URL ? fileURLToPath(file) : path.resolve(file);
  let raw;
  try {
    raw = fs.readFileSync(resolved, 'utf8');
  } catch {
    throw new Error(`profile not found: ${resolved}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`profile ${resolved} is not valid JSON: ${error.message}`);
  }
  return {
    routes: compileRoutes(parsed.routes),
    selectors: compileSelectors(parsed.selectors),
    card: parsed.card ?? {},
  };
}
