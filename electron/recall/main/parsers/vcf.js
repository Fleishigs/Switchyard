'use strict';

const { normalizeNumber } = require('../phone');

// Decode a Quoted-Printable string (used by vCard 2.1 for non-ASCII names,
// e.g. Hebrew). Joins =XX byte sequences and decodes as the given charset.
function decodeQuotedPrintable(value, charset) {
  const bytes = [];
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '=' && i + 2 < value.length) {
      const hex = value.substr(i + 1, 2);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(ch.charCodeAt(0));
  }
  try {
    return Buffer.from(bytes).toString(charset || 'utf-8');
  } catch {
    return Buffer.from(bytes).toString('utf-8');
  }
}

// Unfold vCard lines: physical lines beginning with a space/tab continue the
// previous line, and a trailing "=" marks a Quoted-Printable soft line break.
function unfoldLines(text) {
  const raw = text.split(/\r\n|\r|\n/);
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    let line = raw[i];
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) {
      out[out.length - 1] += line.slice(1);
      continue;
    }
    // Quoted-printable soft break: line ends with "=" → join next physical line.
    while (line.endsWith('=') && i + 1 < raw.length) {
      line = line.slice(0, -1) + raw[++i];
    }
    out.push(line);
  }
  return out;
}

function parsePropertyName(rawName) {
  const parts = rawName.split(';');
  const name = parts.shift().toUpperCase();
  const params = {};
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq === -1) {
      // valueless param, e.g. "CELL", "PREF", "HOME"
      params[p.toUpperCase()] = true;
    } else {
      params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
    }
  }
  return { name, params };
}

function decodeValue(value, params) {
  const enc = (params.ENCODING || '').toString().toUpperCase();
  const charset = (params.CHARSET || 'utf-8').toString();
  if (enc.includes('QUOTED-PRINTABLE')) {
    return decodeQuotedPrintable(value, charset);
  }
  return value;
}

function composeNameFromN(nValue) {
  // N = Family;Given;Additional;Prefix;Suffix
  const f = nValue.split(';').map((s) => s.trim());
  const given = f[1] || '';
  const family = f[0] || '';
  const full = [given, family].filter(Boolean).join(' ').trim();
  return full;
}

// Parse a .vcf file's text content into a Map of normalized-number -> name,
// plus the list of contacts (for an optional contacts view later).
function parseVcf(text) {
  const numberToName = new Map();
  const contacts = [];
  const lines = unfoldLines(text);

  let current = null;
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith('BEGIN:VCARD')) {
      current = { fn: '', n: '', tels: [] };
      continue;
    }
    if (upper.startsWith('END:VCARD')) {
      if (current) {
        const name = current.fn || (current.n ? composeNameFromN(current.n) : '');
        const numbers = [];
        for (const tel of current.tels) {
          const key = normalizeNumber(tel);
          if (key) {
            numbers.push(tel);
            if (name && !numberToName.has(key)) numberToName.set(key, name);
          }
        }
        if (name || numbers.length) contacts.push({ name, numbers });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const { name, params } = parsePropertyName(line.slice(0, colon));
    const rawValue = line.slice(colon + 1);
    const value = decodeValue(rawValue, params);

    if (name === 'FN') current.fn = value.trim();
    else if (name === 'N') current.n = value;
    else if (name === 'TEL') current.tels.push(value.trim());
  }

  return { numberToName, contacts };
}

module.exports = { parseVcf };
