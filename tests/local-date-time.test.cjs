const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function load(file, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date, Intl, Number, require: (id) => {
    if (Object.hasOwn(dependencies, id)) return dependencies[id];
    if (id === "react/jsx-runtime") return require(id);
    throw new Error(id);
  } });
  return exports;
}
const formatting = load("src/lib/local-date-time.ts");

test("the same UTC instant displays the afternoon on a Vietnam device and the morning in Los Angeles", () => {
  const iso = "2026-11-18T09:33:40.480Z";
  assert.equal(formatting.formatLocalDateTime(iso, "Asia/Ho_Chi_Minh"), "18/11/2026 16:33:40");
  assert.equal(formatting.formatLocalDateTime(iso, "America/Los_Angeles"), "18/11/2026 01:33:40");
  assert.equal(formatting.formatLocalDateTime(iso, "UTC"), "18/11/2026 09:33:40");
});

test("day rollover and midnight use the selected device timezone, with no double UTC offset", () => {
  assert.equal(formatting.formatLocalDateTime("2026-11-17T17:00:00Z", "Asia/Ho_Chi_Minh"), "18/11/2026 00:00:00");
  assert.equal(formatting.formatLocalDateTime("2026-11-18T16:33:40+07:00", "Asia/Ho_Chi_Minh"), "18/11/2026 16:33:40");
});

test("ambiguous timestamps and invalid timezones do not silently display a guessed time", () => {
  for (const value of ["", "2026-11-18 09:33:40", "2026-11-18T09:33:40", "not a date", "2026-99-18T09:33:40Z"]) {
    assert.equal(formatting.formatLocalDateTime(value, "Asia/Ho_Chi_Minh"), "—");
  }
  assert.equal(formatting.formatLocalDateTime("2026-11-18T09:33:40Z", "invalid/zone"), "—");
});

test("server rendering avoids a wrong server-local hour; hydrated device time preserves the original instant", () => {
  const file = "src/components/local-date-time.tsx";
  const iso = "2026-11-18T09:33:40.480Z";
  const server = load(file, { react: React, "@/lib/local-date-time": formatting });
  const markup = renderToStaticMarkup(React.createElement(server.LocalDateTime, { iso }));
  assert.match(markup, /…/);
  assert.ok(!markup.includes(">09:33"));
  for (const zone of ["Asia/Ho_Chi_Minh", "America/Los_Angeles"]) {
    const client = load(file, { react: { useSyncExternalStore: (_subscribe, getDevice, getServer) => {
      assert.equal(getServer(), null);
      assert.equal(typeof getDevice(), "string");
      return zone;
    } }, "@/lib/local-date-time": formatting });
    const time = client.LocalDateTime({ iso });
    assert.equal(time.props.dateTime, iso);
    assert.equal(time.props.children, formatting.formatLocalDateTime(iso, zone));
    assert.equal(time.props.title, `Giờ thiết bị: ${zone}`);
  }
});
