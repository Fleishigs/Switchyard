"use strict";

// Convert the custom NDJSON backup back into SMS Backup & Restore XML.
// Streams to disk so very large exports (with base64 attachments) stay
// memory-safe. Schema matched against a real SMS Backup & Restore v10.24 file.

const fs = require("fs");
const path = require("path");
const { normalizeNumber } = require("./phone");

const MON = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function readableDate(ms) {
  if (!ms) return "null";
  const d = new Date(ms);
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${h}:${mm}:${ss} ${ampm}`;
}

// MMS `date` in this backup is in seconds; the XML wants milliseconds.
function mmsDateMs(v) {
  let n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n > 0 && n < 1e12) n *= 1000;
  return Math.round(n);
}

function esc(v) {
  if (v === undefined || v === null) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/\r/g, "&#13;")
    .replace(/\n/g, "&#10;")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

// Build `key="value"` pairs from an ordered array of [key, value]. A null/
// undefined value is written literally as the string "null" (matches SMS B&R).
function attrLine(pairs) {
  const parts = [];
  for (const [k, v, raw] of pairs) {
    if (raw)
      parts.push(`${k}="${v}"`); // pre-formatted (e.g. base64)
    else if (v === undefined || v === null || v === "")
      parts.push(`${k}="null"`);
    else parts.push(`${k}="${esc(v)}"`);
  }
  return parts.join(" ");
}

function isMmsRecord(r) {
  return !!(
    r.__parts ||
    r.__sender_address ||
    r.__recipient_addresses ||
    r.msg_box ||
    r.m_type
  );
}

function mmsOtherAddress(r) {
  if (String(r.msg_box) === "2") {
    const recs = r.__recipient_addresses || [];
    if (recs.length) return recs[0].address || "";
  }
  if (r.__sender_address && r.__sender_address.address)
    return r.__sender_address.address;
  const recs = r.__recipient_addresses || [];
  if (recs.length) return recs[0].address || "";
  return r.address || "";
}

function cleanName(n) {
  return n && n.trim() && n.trim().toLowerCase() !== "me" ? n.trim() : "";
}

function smsContactName(r, numberToName) {
  return (
    (numberToName && numberToName.get(normalizeNumber(r.address))) ||
    cleanName(r.__display_name) ||
    "(Unknown)"
  );
}

function mmsContactName(r, numberToName) {
  let cand = "";
  let addr = "";
  if (String(r.msg_box) === "2") {
    const named = (r.__recipient_addresses || []).find((a) =>
      cleanName(a.__display_name),
    );
    cand = named ? cleanName(named.__display_name) : "";
    addr = mmsOtherAddress(r);
  } else {
    cand = r.__sender_address
      ? cleanName(r.__sender_address.__display_name)
      : "";
    addr = (r.__sender_address && r.__sender_address.address) || "";
  }
  return (
    (numberToName && numberToName.get(normalizeNumber(addr))) ||
    cleanName(r.__display_name) ||
    cand ||
    "(Unknown)"
  );
}

// Returns an async function that resolves once a chunk is flushed (backpressure).
function makeWriter(stream) {
  return (chunk) =>
    new Promise((resolve, reject) =>
      stream.write(chunk, (error) => (error ? reject(error) : resolve())),
    );
}

// Main entry. records = raw NDJSON objects; dataDir/dataFiles locate attachments.
// onProgress(done, total, embedded) is called periodically.
async function writeXml(
  records,
  dataDir,
  dataFiles,
  outPath,
  onProgress,
  numberToName,
) {
  const total = records.length;
  let done = 0;
  let embedded = 0;

  const stream = fs.createWriteStream(outPath, { encoding: "utf8" });
  stream.on("error", () => {});
  const write = makeWriter(stream);

  try {
    const created = readableDate(Date.now());
    await write(`<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>\n`);
    await write(`<!--File Created By Recall on ${created}-->\n`);
    await write(
      `<smses count="${total}" backup_set="${cryptoGuid()}" backup_date="${Date.now()}" type="full">\n`,
    );

    for (const r of records) {
      if (isMmsRecord(r)) {
        await write(buildMms(r));
        embedded += countEmbeddable(r, dataDir, dataFiles);
        // buildMms reads files synchronously inside; ensure backpressure respected.
        await maybeDrain(stream);
      } else {
        await write(buildSms(r));
      }
      done++;
      if (onProgress && (done % 200 === 0 || done === total))
        onProgress(done, total, embedded);
    }

    await write(`</smses>\n`);
    await new Promise((resolve, reject) =>
      stream.end((err) => (err ? reject(err) : resolve())),
    );

    return { count: total, embedded, outPath };
  } finally {
    stream.destroy();
  }

  // ---- inner builders (capture dataDir/dataFiles) ----
  function buildSms(r) {
    const dateMs = Number(r.date) || 0;
    const line = attrLine([
      ["protocol", r.protocol != null ? r.protocol : "0"],
      ["address", r.address],
      ["date", r.date],
      ["type", r.type != null ? r.type : "1"],
      ["subject", r.subject != null ? r.subject : null],
      ["body", r.body != null ? r.body : ""],
      ["toa", null],
      ["sc_toa", null],
      ["service_center", r.service_center],
      ["read", r.read != null ? r.read : "1"],
      ["status", r.status != null ? r.status : "-1"],
      ["locked", r.locked != null ? r.locked : "0"],
      ["date_sent", r.date_sent != null ? r.date_sent : "0"],
      ["sub_id", r.sub_id != null ? r.sub_id : "-1"],
      ["readable_date", readableDate(dateMs)],
      ["contact_name", smsContactName(r, numberToName)],
    ]);
    return `  <sms ${line} />\n`;
  }

  function buildMms(r) {
    const dateMs = mmsDateMs(r.date);
    const head = attrLine([
      ["date", String(dateMs)],
      ["rr", r.rr],
      ["sub", r.sub],
      ["ct_t", r.ct_t || "application/vnd.wap.multipart.related"],
      ["read_status", r.read_status],
      ["seen", r.seen != null ? r.seen : "1"],
      ["msg_box", r.msg_box],
      ["address", mmsOtherAddress(r)],
      ["sub_cs", r.sub_cs],
      ["resp_st", r.resp_st],
      ["retr_st", r.retr_st],
      ["d_tm", r.d_tm],
      ["text_only", r.text_only != null ? r.text_only : "0"],
      ["exp", r.exp],
      ["locked", r.locked != null ? r.locked : "0"],
      ["m_id", r.m_id],
      ["st", r.st],
      ["retr_txt_cs", r.retr_txt_cs],
      ["retr_txt", r.retr_txt],
      ["creator", r.creator || "com.riteshsahu.SMSBackupRestore"],
      ["date_sent", r.date_sent != null ? r.date_sent : "0"],
      ["read", r.read != null ? r.read : "1"],
      ["m_size", r.m_size],
      ["rpt_a", r.rpt_a],
      ["ct_cls", r.ct_cls],
      ["pri", r.pri],
      ["sub_id", r.sub_id != null ? r.sub_id : "-1"],
      ["tr_id", r.tr_id],
      ["resp_txt", r.resp_txt],
      ["ct_l", r.ct_l],
      ["m_cls", r.m_cls || "personal"],
      ["d_rpt", r.d_rpt],
      ["v", r.v],
      ["_id", r._id],
      ["m_type", r.m_type],
      ["readable_date", readableDate(dateMs)],
      ["contact_name", mmsContactName(r, numberToName)],
    ]);

    let out = `  <mms ${head}>\n    <parts>\n`;
    const parts = Array.isArray(r.__parts) ? r.__parts : [];
    for (const p of parts) {
      out += buildPart(p);
    }
    out += `    </parts>\n    <addrs>\n`;
    out += buildAddrs(r);
    out += `    </addrs>\n  </mms>\n`;
    return out;
  }

  function buildPart(p) {
    const pairs = [
      ["seq", p.seq != null ? p.seq : "0"],
      ["ct", p.ct || "application/octet-stream"],
      ["name", p.name || p.cl || null],
      ["chset", p.chset],
      ["cd", p.cd],
      ["fn", p.fn],
      ["cid", p.cid],
      ["cl", p.cl],
      ["ctt_s", p.ctt_s],
      ["ctt_t", p.ctt_t],
      ["text", p.text != null ? p.text : null],
    ];
    // Embed binary attachment data as base64 when the file is present.
    let dataAttr = "";
    const base = p._data
      ? path.basename(String(p._data).replace(/\\/g, "/"))
      : null;
    if (base && dataFiles && dataFiles.has(base)) {
      try {
        const b64 = fs
          .readFileSync(path.join(dataDir, base))
          .toString("base64");
        dataAttr = ` data="${b64}"`;
      } catch {
        throw new Error("Could not read attachment: " + base);
      }
    }
    if (base && !dataAttr)
      throw new Error(
        "Missing attachment: " +
          base +
          ". Export requires the complete Fig ZIP backup.",
      );
    return `      <part ${attrLine(pairs)}${dataAttr} />\n`;
  }

  function buildAddrs(r) {
    let out = "";
    const seen = new Set();
    const add = (address, type, charset) => {
      if (!address) return;
      const key = address + "|" + type;
      if (seen.has(key)) return;
      seen.add(key);
      out += `      <addr ${attrLine([
        ["address", address],
        ["type", type],
        ["charset", charset != null ? charset : "106"],
      ])} />\n`;
    };
    if (r.__sender_address)
      add(
        r.__sender_address.address,
        r.__sender_address.type || "137",
        r.__sender_address.charset,
      );
    const recs = r.__recipient_addresses || [];
    for (const a of recs) add(a.address, a.type || "151", a.charset);
    if (!out) add(r.address, "151", "106"); // fallback
    return out;
  }
}

function countEmbeddable(r, dataDir, dataFiles) {
  let n = 0;
  const parts = Array.isArray(r.__parts) ? r.__parts : [];
  for (const p of parts) {
    const base = p._data
      ? path.basename(String(p._data).replace(/\\/g, "/"))
      : null;
    if (base && dataFiles && dataFiles.has(base)) n++;
  }
  return n;
}

function maybeDrain(stream) {
  if (stream.writableNeedDrain)
    return new Promise((res) => stream.once("drain", res));
  return Promise.resolve();
}

// A simple RFC4122-ish GUID without extra deps.
function cryptoGuid() {
  const b = require("crypto").randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

module.exports = { writeXml };
