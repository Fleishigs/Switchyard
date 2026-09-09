'use strict';

// Reduce any phone/address string to a stable key used for contact matching.
// - Strips formatting characters.
// - Drops a leading US country code "1" when the result is 11 digits.
// - Returns the last 10 digits for normal numbers; short codes / non-numeric
//   addresses (e.g. "90347", email-to-text gateways) are returned as-is.
function normalizeNumber(raw) {
  if (raw === undefined || raw === null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  // Email-style addresses (some MMS senders) — keep lowercased intact.
  if (s.includes('@')) return s.toLowerCase();
  let digits = s.replace(/[^\d]/g, '');
  if (!digits) return s.toLowerCase();
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  // Preserve international prefixes to avoid merging different contacts.
  return digits;
}

// Human-friendly display of a phone number / address.
function formatNumber(raw) {
  if (raw === undefined || raw === null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  if (s.includes('@')) return s;
  const digits = s.replace(/[^\d]/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    const d = digits.slice(1);
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  // Short codes and anything unusual: show as stored.
  return s;
}

module.exports = { normalizeNumber, formatNumber };
