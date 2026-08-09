import test from "node:test";
import assert from "node:assert/strict";
import { buildManifest, getManagedFileHash } from "./manifest.js";

function buildManagedOperation(overrides = {}) {
  return {
    type: "file",
    managed: true,
    targetRelative: "AGENTS.md",
    sourceRelative: "templates/AGENTS.md",
    kind: "managed-block",
    status: "unchanged",
    frameworkHash: "managed-hash",
    renderedHash: "rendered-file-hash",
    templateHash: "template-hash",
    renderInputHash: "render-input-hash",
    ...overrides
  };
}

test("buildManifest records render metadata while keeping hash as managed-content compatibility field", () => {
  const manifest = buildManifest({
    version: "0.0.0-test",
    installedAt: "2026-06-15T00:00:00.000Z",
    previousManifest: null,
    operations: [buildManagedOperation()]
  });

  const [record] = manifest.managedFiles;
  assert.equal(record.hash, "managed-hash");
  assert.equal(record.renderedHash, "rendered-file-hash");
  assert.equal(record.templateHash, "template-hash");
  assert.equal(record.renderInputHash, "render-input-hash");
  assert.equal(getManagedFileHash(record), "managed-hash");
});

test("buildManifest preserves prior compatibility hash for modified-local records without dropping render metadata", () => {
  const manifest = buildManifest({
    version: "0.0.0-test",
    installedAt: "2026-06-15T00:00:00.000Z",
    previousManifest: null,
    operations: [buildManagedOperation({
      status: "modified-local",
      previousHash: "previous-managed-hash",
      frameworkHash: "next-managed-hash",
      renderedHash: "next-rendered-file-hash",
      templateHash: "next-template-hash",
      renderInputHash: "next-render-input-hash"
    })]
  });

  const [record] = manifest.managedFiles;
  assert.equal(record.hash, "previous-managed-hash");
  assert.equal(record.renderedHash, "next-rendered-file-hash");
  assert.equal(record.templateHash, "next-template-hash");
  assert.equal(record.renderInputHash, "next-render-input-hash");
  assert.equal(getManagedFileHash(record), "previous-managed-hash");
});

test("getManagedFileHash still falls back to renderedHash for legacy-compatible records missing hash", () => {
  assert.equal(getManagedFileHash({ renderedHash: "legacy-rendered-hash" }), "legacy-rendered-hash");
  assert.equal(getManagedFileHash(null), null);
});

test("getManagedFileHash prefers compatibility hash when hash and renderedHash differ", () => {
  assert.equal(
    getManagedFileHash({ hash: "managed-region-hash", renderedHash: "full-rendered-file-hash" }),
    "managed-region-hash"
  );
});

test("buildManifest records project-only Pi package metadata", () => {
  const manifest = buildManifest({
    version: "1.0.0",
    installedAt: "2026-08-09T00:00:00.000Z",
    previousManifest: null,
    operations: [],
    piPackageSource: "npm:marionettist-pathway-pi"
  });
  assert.equal(manifest.piPackageSource, "npm:marionettist-pathway-pi");
  assert.equal(manifest.piInstallScope, "project");
});
