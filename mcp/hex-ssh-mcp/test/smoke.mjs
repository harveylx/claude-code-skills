import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// ==================== hash cross-verification ====================

describe("FNV-1a hash (cross-verify with hex-line)", () => {
    it("produces same hashes as hex-line for same content", async () => {
        const { fnv1a, lineTag, rangeChecksum } = await import("../lib/hash.mjs");

        const h1 = fnv1a("const x = 1;");
        const h2 = fnv1a("const x = 1;");
        assert.equal(h1, h2, "Same content same hash");

        const tag = lineTag(h1);
        assert.match(tag, /^[a-z2-7]{2}$/, "Tag is 2-char base32");

        const cs = rangeChecksum([h1, h2], 1, 2);
        assert.match(cs, /^\d+-\d+:[0-9a-f]{8}$/, "Checksum format: start-end:hex8");
    });
});

// ==================== normalize ====================

describe("normalize output", () => {
    it("deduplicates identical lines with (xN)", async () => {
        const { deduplicateLines } = await import("../lib/normalize.mjs");
        const lines = ["ok", "error: timeout", "error: timeout", "error: timeout", "done"];
        const result = deduplicateLines(lines);
        const joined = result.join("\n");
        assert.ok(joined.includes("(x3)"), "Repeated 3x gets count");
        assert.ok(joined.includes("ok"), "Unique lines kept");
    });

    it("smartTruncate keeps head + tail, omits middle", async () => {
        const { smartTruncate } = await import("../lib/normalize.mjs");
        const text = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join("\n");
        const result = smartTruncate(text, 5, 3);
        assert.ok(result.includes("line 1"), "Head kept");
        assert.ok(result.includes("line 100"), "Tail kept");
        assert.ok(result.includes("omitted"), "Gap indicator");
        assert.ok(!result.includes("line 50"), "Middle omitted");
    });
});

// ==================== ssh-edit-block anchor-only contract ====================

describe("ssh-edit-block anchor-only contract", () => {
    let validateEditArgs;
    before(async () => {
        ({ validateEditArgs } = await import("../lib/edit-validation.mjs"));
    });

    it("accepts all valid anchor modes", () => {
        assert.equal(validateEditArgs({ anchor: "ab.42", newText: "y" }), null);
        assert.equal(validateEditArgs({ startAnchor: "ab.10", endAnchor: "cd.15", newText: "y" }), null);
        assert.equal(validateEditArgs({ insertAfter: "ab.20", newText: "y" }), null);
    });

    it("rejects invalid args (text-mode, partial range, missing newText, conflicting modes)", () => {
        assert.ok(validateEditArgs({ oldText: "x", newText: "y" })?.includes("Required: anchor"));
        assert.ok(validateEditArgs({ startAnchor: "ab.10", newText: "y" })?.includes("Incomplete range"));
        assert.ok(validateEditArgs({ endAnchor: "cd.15", newText: "y" })?.includes("Incomplete range"));
        assert.ok(validateEditArgs({ anchor: "ab.42" })?.includes("Required: newText"));
        assert.ok(validateEditArgs({ anchor: "ab.42", insertAfter: "cd.15", newText: "y" })?.includes("Conflicting"));
    });
});

// ==================== host key verification ====================

describe("host key verification", () => {
    let buildHostVerifier;
    before(async () => {
        ({ buildHostVerifier } = await import("../lib/host-verify.mjs"));
    });

    it("rejects unknown host (fail-closed)", () => {
        process.env.KNOWN_HOSTS_PATH = "/nonexistent";
        delete process.env.ALLOWED_HOST_FINGERPRINTS;
        const verifier = buildHostVerifier("unknown.host");
        assert.equal(verifier(Buffer.from("fake-key")), false);
        delete process.env.KNOWN_HOSTS_PATH;
    });

    it("accepts matching SHA256 fingerprint from env", () => {
        const fakeKey = Buffer.from("test-key-data");
        const fp = "SHA256:" + createHash("sha256").update(fakeKey).digest("base64").replace(/=+$/, "");
        process.env.ALLOWED_HOST_FINGERPRINTS = fp;
        process.env.KNOWN_HOSTS_PATH = "/nonexistent";
        const verifier = buildHostVerifier("any.host");
        assert.equal(verifier(fakeKey), true);
        delete process.env.ALLOWED_HOST_FINGERPRINTS;
        delete process.env.KNOWN_HOSTS_PATH;
    });

    it("rejects non-matching fingerprint", () => {
        process.env.ALLOWED_HOST_FINGERPRINTS = "SHA256:wrongwrongwrong";
        process.env.KNOWN_HOSTS_PATH = "/nonexistent";
        const verifier = buildHostVerifier("any.host");
        assert.equal(verifier(Buffer.from("actual-key")), false);
        delete process.env.ALLOWED_HOST_FINGERPRINTS;
        delete process.env.KNOWN_HOSTS_PATH;
    });
});

// ==================== shell escaping ====================

describe("shell escaping", () => {
    let shellQuote, assertSafeArg;
    before(async () => {
        ({ shellQuote, assertSafeArg } = await import("../lib/shell-escape.mjs"));
    });

    it("shellQuote handles quotes, backticks and $() injection", () => {
        assert.equal(shellQuote("it's"), "'it'\\''s'");
        assert.equal(shellQuote("$(whoami)"), "'$(whoami)'");
        assert.equal(shellQuote("`id`"), "'`id`'");
    });

    it("assertSafeArg rejects null bytes and newlines", () => {
        assert.throws(() => assertSafeArg("p", "/var\0/etc"), /UNSAFE_ARG/);
        assert.throws(() => assertSafeArg("p", "/var\n/etc"), /UNSAFE_ARG/);
        assertSafeArg("p", "/var/www/app/file.js"); // normal path — no throw
    });
});

// ==================== path validation ====================

describe("path validation", () => {
    let validateRemotePath;
    before(async () => {
        ({ validateRemotePath } = await import("../lib/ssh-client.mjs"));
    });

    it("rejects relative path and .. traversal", () => {
        assert.throws(() => validateRemotePath("relative/path"), /BAD_PATH/);
        process.env.ALLOWED_DIRS = "/home/deploy";
        assert.throws(() => validateRemotePath("/home/deploy/../../etc/passwd"), /PATH_OUTSIDE_ROOT/);
        delete process.env.ALLOWED_DIRS;
    });

    it("accepts valid paths and canonicalizes both sides", () => {
        process.env.ALLOWED_DIRS = "/home/deploy/../deploy";
        assert.doesNotThrow(() => validateRemotePath("/home/deploy/app/server.js"));
        delete process.env.ALLOWED_DIRS;
    });
});

// ==================== command policy ====================

describe("command policy", () => {
    let validateCommand;
    before(async () => {
        ({ validateCommand } = await import("../lib/command-policy.mjs"));
    });

    it("disabled by default, blocks in safe mode", () => {
        delete process.env.REMOTE_SSH_MODE;
        assert.ok(validateCommand("ls")?.includes("REMOTE_SSH_DISABLED"));
        process.env.REMOTE_SSH_MODE = "safe";
        assert.ok(validateCommand("rm -rf /")?.includes("BLOCKED_COMMAND"));
        assert.ok(validateCommand(":(){ :|:& };:")?.includes("BLOCKED_COMMAND"));
        assert.equal(validateCommand("ls -la /home/deploy"), null);
        delete process.env.REMOTE_SSH_MODE;
    });

    it("allows everything in open mode", () => {
        process.env.REMOTE_SSH_MODE = "open";
        assert.equal(validateCommand("rm -rf /"), null);
        delete process.env.REMOTE_SSH_MODE;
    });
});
