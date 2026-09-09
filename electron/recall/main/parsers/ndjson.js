"use strict";

const path = require("path");
const { normalizeNumber, formatNumber } = require("../phone");

// SMS `type` values that mean "sent by me" (outgoing): sent, outbox, failed, queued.
const SMS_OUTGOING = new Set(["2", "4", "5", "6"]);

function toMillis(dateVal) {
  if (dateVal === undefined || dateVal === null || dateVal === "") return 0;
  let n = Number(dateVal);
  if (!Number.isFinite(n)) return 0;
  // SMS dates are 13-digit ms; MMS dates in this format are 10-digit seconds.
  // Anything below ~1e12 is treated as seconds since epoch.
  if (n > 0 && n < 1e12) n *= 1000;
  return Math.round(n);
}

function basenameOfDataPath(p) {
  if (!p) return null;
  const norm = String(p).replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  return idx === -1 ? norm : norm.slice(idx + 1);
}

function mimeKind(ct) {
  const c = (ct || "").toLowerCase();
  if (c.startsWith("image/")) return "image";
  if (c.startsWith("audio/")) return "audio";
  if (c.startsWith("video/")) return "video";
  if (c.includes("vcard")) return "vcard";
  return "file";
}

// Build the full in-memory model from the parsed NDJSON records.
// `dataFiles` is a Set of attachment basenames that actually exist in data/.
// `numberToName` is an optional Map(normalizedNumber -> contactName) from the
// imported .vcf; contact names take priority over names stored in the backup.
function buildModel(records, dataFiles, numberToName = new Map()) {
  // 1. Discover which addresses are "me".
  const meKeys = new Set();
  for (const r of records) {
    if (r.__sender_address && String(r.msg_box) === "2") {
      const k = normalizeNumber(r.__sender_address.address);
      if (k) meKeys.add(k);
    }
    const dn =
      r.__display_name ||
      (r.__sender_address && r.__sender_address.__display_name);
    if (dn && dn.trim().toLowerCase() === "me" && r.address) {
      // Only trust "Me" labels attached to the sender side of an MMS.
    }
  }
  // Also honor any explicit "Me" sender display names.
  for (const r of records) {
    if (
      r.__sender_address &&
      (r.__sender_address.__display_name || "").trim().toLowerCase() === "me"
    ) {
      const k = normalizeNumber(r.__sender_address.address);
      if (k) meKeys.add(k);
    }
  }

  const threads = new Map(); // threadId -> thread object
  const messagesByThread = new Map(); // threadId -> [messages]
  const participantNames = new Map(); // threadId -> Map(numberKey -> {name, number})

  function ensureThread(id) {
    if (!threads.has(id)) {
      threads.set(id, {
        id,
        title: "",
        participants: [],
        isGroup: false,
        lastDate: 0,
        lastSnippet: "",
        messageCount: 0,
      });
      messagesByThread.set(id, []);
      participantNames.set(id, new Map());
    }
    return threads.get(id);
  }

  function recordParticipant(threadId, address, displayName) {
    const key = normalizeNumber(address);
    if (!key || meKeys.has(key)) return;
    const map = participantNames.get(threadId);
    const existing = map.get(key);
    const name =
      displayName &&
      displayName.trim() &&
      displayName.trim().toLowerCase() !== "me"
        ? displayName.trim()
        : (existing && existing.name) || "";
    map.set(key, { number: address, name });
  }

  for (const r of records) {
    const threadId = String(r.thread_id || "unknown");
    ensureThread(threadId);
    const ts = toMillis(r.date);
    const isMms = !!(r.__parts || r.__sender_address || r.msg_box || r.m_type);

    let dir,
      sender,
      attachments = [],
      body = r.body || "";

    if (isMms) {
      const outgoing = String(r.msg_box) === "2";
      dir = outgoing ? "out" : "in";

      // Gather text + attachments from parts.
      const textPieces = [];
      const parts = Array.isArray(r.__parts) ? r.__parts : [];
      for (const part of parts) {
        const ct = (part.ct || "").toLowerCase();
        if (ct === "application/smil") continue; // layout only
        if (ct === "text/plain") {
          if (part.text) textPieces.push(part.text);
          continue;
        }
        const kind = mimeKind(ct);
        const base = basenameOfDataPath(part._data);
        const exists = base && dataFiles.has(base);
        if (kind === "vcard") {
          attachments.push({
            kind: "vcard",
            mime: ct,
            file: exists ? base : null,
            name: part.cl || part.name || "Contact",
            text: part.text || "",
          });
        } else if (exists) {
          attachments.push({
            kind,
            mime: ct,
            file: base,
            name: part.cl || part.name || base,
          });
        } else if (part.text) {
          textPieces.push(part.text);
        }
      }
      if (textPieces.length) body = textPieces.join("\n");

      // Sender / participants.
      const senderAddr = r.__sender_address || {};
      if (outgoing) {
        sender = { name: "Me", number: senderAddr.address || "", isMe: true };
      } else {
        sender = {
          name:
            (senderAddr.__display_name &&
            senderAddr.__display_name.trim().toLowerCase() !== "me"
              ? senderAddr.__display_name
              : "") || "",
          number: senderAddr.address || "",
          isMe: false,
        };
        recordParticipant(
          threadId,
          senderAddr.address,
          senderAddr.__display_name,
        );
      }
      const recips = Array.isArray(r.__recipient_addresses)
        ? r.__recipient_addresses
        : [];
      for (const rc of recips) {
        recordParticipant(threadId, rc.address, rc.__display_name);
      }
    } else {
      // Plain SMS.
      const outgoing = SMS_OUTGOING.has(String(r.type));
      dir = outgoing ? "out" : "in";
      if (outgoing) {
        sender = { name: "Me", number: "", isMe: true };
      } else {
        sender = {
          name:
            (r.__display_name && r.__display_name.trim().toLowerCase() !== "me"
              ? r.__display_name
              : "") || "",
          number: r.address || "",
          isMe: false,
        };
      }
      recordParticipant(threadId, r.address, r.__display_name);
    }

    const msg = {
      id: String(r._id || ""),
      dir,
      ts,
      body: body || "",
      sender,
      attachments,
    };
    messagesByThread.get(threadId).push(msg);
  }

  // Finalize threads: sort messages, compute titles, participants, snippet.
  const colorPalette = 8; // for group sender coloring (assigned in renderer)
  for (const [id, thread] of threads) {
    const msgs = messagesByThread.get(id);
    msgs.sort((a, b) => a.ts - b.ts);

    const pmap = participantNames.get(id);
    const participants = [...pmap.entries()].map(([key, v]) => {
      const contactName = numberToName.get(key);
      const name = contactName || v.name || formatNumber(v.number);
      return {
        key,
        number: v.number,
        name,
        hasName: !!(contactName || v.name),
      };
    });
    thread.participants = participants;
    thread.isGroup = participants.length > 1;

    // Assign a stable color index to each participant key (for group bubbles).
    participants.forEach((p, i) => {
      p.colorIndex = i % colorPalette;
    });
    const colorByKey = new Map(participants.map((p) => [p.key, p.colorIndex]));
    for (const m of msgs) {
      if (m.dir === "in") {
        const k = normalizeNumber(m.sender.number);
        m.sender.colorIndex = colorByKey.has(k) ? colorByKey.get(k) : 0;
        // Prefer the resolved participant name (contact name wins over backup).
        const p = participants.find((pp) => pp.key === k);
        if (p && p.hasName) m.sender.name = p.name;
        else if (!m.sender.name)
          m.sender.name = p ? p.name : formatNumber(m.sender.number);
      }
    }

    if (thread.isGroup) {
      const names = participants.map((p) => p.name.split(" ")[0]);
      thread.title =
        names.slice(0, 3).join(", ") +
        (names.length > 3 ? ` +${names.length - 3}` : "");
    } else if (participants.length === 1) {
      thread.title = participants[0].name;
    } else {
      thread.title = "Unknown";
    }

    const last = msgs[msgs.length - 1];
    thread.lastDate = last ? last.ts : 0;
    thread.messageCount = msgs.length;
    if (last) {
      let snip = last.body && last.body.trim();
      if (!snip && last.attachments.length) {
        const k = last.attachments[0].kind;
        snip =
          k === "image"
            ? "📷 Photo"
            : k === "audio"
              ? "🎵 Voice message"
              : k === "video"
                ? "🎬 Video"
                : k === "vcard"
                  ? "👤 Contact"
                  : "📎 Attachment";
      }
      thread.lastSnippet = (last.dir === "out" ? "You: " : "") + (snip || "");
    }
  }

  const threadList = [...threads.values()].sort(
    (a, b) => b.lastDate - a.lastDate,
  );

  return {
    meKeys: [...meKeys],
    threadList,
    messagesByThread, // Map
  };
}

// Parse raw NDJSON text into records.
function parseNdjson(text) {
  const records = [];
  const lines = text.split(/\r\n|\r|\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const t = line.trim();
    if (!t) continue;
    try {
      const value = JSON.parse(t);
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("Invalid message record");
      if (!(
        "body" in value ||
        "__parts" in value ||
        "address" in value ||
        "msg_box" in value
      ))
        throw new Error("Not a Fig message");
      records.push(value);
    } catch {
      throw new Error(
        "Invalid Fig message on line " +
          (index + 1) +
          ". Import stopped to avoid losing messages.",
      );
    }
  }
  return records;
}

module.exports = { parseNdjson, buildModel, toMillis };
