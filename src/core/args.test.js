import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { parseCommonArgs } from "./args.js";

test("parseCommonArgs defaults clear scope to all without apply", () => {
  const options = parseCommonArgs([]);

  assert.equal(options.apply, false);
  assert.equal(options.scope, "all");
  assert.equal(options.project, path.resolve(process.cwd()));
});

test("parseCommonArgs accepts clear apply and scope options", () => {
  const options = parseCommonArgs(["--project", "fixtures", "--apply", "--scope", "opencode"]);

  assert.equal(options.apply, true);
  assert.equal(options.scope, "opencode");
  assert.equal(options.project, path.resolve("fixtures"));
});

test("parseCommonArgs rejects unsupported clear scope", () => {
  assert.throws(
    () => parseCommonArgs(["--scope", "manifest"]),
    /Unsupported --scope value: manifest/
  );
});

test("parseCommonArgs accepts project-local Pi pathway selection", () => {
  const options = parseCommonArgs(["--with-pi"]);
  assert.equal(options.withPi, true);
});
