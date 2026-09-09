export function textFixture(id) {
  if (id === "text-csv-json")
    return 'name,value\nSwitchyard,42\n"Two, words",7';
  if (id === "text-json-csv")
    return '[{"name":"Switchyard","value":42},{"name":"Second","value":7}]';
  if (id.includes("json")) return '{"hello":true}';
  if (id === "text-unbase64") return "SGVsbG8=";
  if (id === "text-unurl") return "Hello%20world";
  if (id === "text-jwt") return "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ0ZXN0In0.";
  return "Hello Switchyard\nHello Switchyard";
}
