import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import parser from "../electron/recall/main/parsers/ndjson.js";
import vcard from "../electron/recall/main/parsers/vcf.js";
import exporter from "../electron/recall/main/export-xml.js";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import phone from "../electron/recall/main/phone.js";
export const records = [
  {
    _id: "1",
    thread_id: "10",
    address: "+15555550101",
    date: "1780000000000",
    type: "1",
    body: 'Hello <world> & "friends"\n×©×œ×•×',
    __display_name: "Old name",
  },
  {
    _id: "2",
    thread_id: "10",
    address: "+15555550101",
    date: "1780000001000",
    type: "2",
    body: "Reply",
  },
  {
    _id: "3",
    thread_id: "20",
    date: "1780000002",
    date_sent: "1780000002",
    msg_box: "1",
    __sender_address: {
      address: "+15555550102",
      __display_name: "Studio",
      type: "137",
    },
    __recipient_addresses: [
      { address: "+15555550103", __display_name: "Workshop", type: "151" },
    ],
    __parts: [
      { ct: "text/plain", text: "Picture", seq: "0" },
      { ct: "image/png", _data: "/data/PART_test", seq: "1" },
    ],
  },
];
test("Recall parses SMS/MMS, chronological conversations, RTL and imported names", () => {
  const contacts = vcard.parseVcf(
    "BEGIN:VCARD\nVERSION:3.0\nFN:New name\nTEL:+15555550101\nEND:VCARD",
  );
  const model = parser.buildModel(
    parser.parseNdjson(records.map((r) => JSON.stringify(r)).join("\n")),
    new Set(["PART_test"]),
    contacts.numberToName,
  );
  assert.equal(model.threadList.length, 2);
  assert.equal(model.messagesByThread.get("10")[1].dir, "out");
  assert.equal(model.threadList.find((t) => t.id === "10").title, "New name");
  assert.match(model.messagesByThread.get("10")[0].body, /×©×œ×•×/);
  assert.equal(parser.toMillis("1780000002"), 1780000002000);
});
test("Recall rejects malformed records instead of silently losing messages", () => {
  for (const text of [
    "null",
    "[]",
    "{}",
    "bad",
    JSON.stringify(records[0]) + "\nno",
  ])
    assert.throws(() => parser.parseNdjson(text), /Invalid Fig message/);
});
test("International contact numbers remain distinct", () => {
  assert.notEqual(
    phone.normalizeNumber("+44 20 5555 0101"),
    phone.normalizeNumber("+33 20 5555 0101"),
  );
  assert.equal(
    phone.normalizeNumber("+1 (555) 555-0101"),
    phone.normalizeNumber("5555550101"),
  );
});
test("Numeric MMS sent flags and folded vCards retain their meaning", () => {
  const model = parser.buildModel(
    [{ ...records[2], msg_box: 2 }],
    new Set(["PART_test"]),
  );
  assert.equal(model.messagesByThread.get("20")[0].dir, "out");
  const value = vcard.parseVcf(
    "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Workshop\r\n  Friend\r\nTEL:+15555550101\r\nEND:VCARD",
  );
  assert.equal(value.numberToName.get("5555550101"), "Workshop Friend");
});
test("Recall XML preserves body, timestamps, contacts and binary attachments", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "recall-xml-"));
  try {
    const bytes = Buffer.from([0, 1, 2, 255]);
    await fs.writeFile(path.join(dir, "PART_test"), bytes);
    const output = path.join(dir, "messages.xml");
    const result = await exporter.writeXml(
      records,
      dir,
      new Set(["PART_test"]),
      output,
      null,
      new Map([["5555550101", "New name"]]),
    );
    assert.equal(result.count, 3);
    assert.equal(result.embedded, 1);
    const text = await fs.readFile(output, "utf8");
    assert.equal(XMLValidator.validate(text), true);
    const xml = new XMLParser({
      htmlEntities: true,
      ignoreAttributes: false,
      attributeNamePrefix: "",
      parseAttributeValue: false,
    }).parse(text).smses;
    assert.equal(xml.sms[0].body, records[0].body);
    assert.equal(xml.mms.date, "1780000002000");
    assert.equal(xml.mms.parts.part[1].data, bytes.toString("base64"));
    await assert.rejects(
      exporter.writeXml(
        records,
        null,
        new Set(),
        path.join(dir, "missing.xml"),
      ),
      /Missing attachment/,
    );
    await assert.rejects(
      exporter.writeXml(
        records,
        dir,
        new Set(["PART_test"]),
        path.join(dir, "absent", "failed.xml"),
      ),
      /ENOENT/,
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
