/**
 * Security boundaries for file operations.
 *
 * - Allowed directories: cwd + ALLOWED_DIRS env
 * - Path canonicalization via realpath
 * - Symlink escape prevention
 * - Binary file detection
 * - Size limits
 */

import { realpathSync, statSync, existsSync, readFileSync } from "node:fs";
import { resolve, isAbsolute, sep } from "node:path";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

let _allowedDirs = null;

/**
 * Get allowed directories (cached).
 * Sources: cwd + ALLOWED_DIRS env (colon-separated on Unix, semicolon on Windows).
 */
function getAllowedDirs() {
    if (_allowedDirs) return _allowedDirs;

    const dirs = [process.cwd()];
    const envDirs = process.env.ALLOWED_DIRS;
    if (envDirs) {
        const delim = process.platform === "win32" ? ";" : ":";
        for (const d of envDirs.split(delim)) {
            const trimmed = d.trim();
            if (trimmed && existsSync(trimmed)) dirs.push(trimmed);
        }
    }

    // Canonicalize all dirs
    _allowedDirs = dirs.map((d) => {
        try { return realpathSync(d); }
        catch { return resolve(d); }
    });
    return _allowedDirs;
}

/**
 * Reset cached allowed dirs (for testing or cwd change).
 */
export function resetAllowedDirs() {
    _allowedDirs = null;
}

/**
 * Validate a file path against security boundaries.
 * Returns the canonicalized absolute path.
 * Throws on violation.
 */
export function validatePath(filePath) {
    if (!filePath) throw new Error("Empty file path");

    const abs = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);

    // Check existence
    if (!existsSync(abs)) throw new Error(`File not found: ${abs}`);

    // Canonicalize (resolves symlinks)
    let real;
    try {
        real = realpathSync(abs);
    } catch (e) {
        throw new Error(`Cannot resolve path: ${abs} (${e.message})`);
    }

    // Check containment in allowed directories
    const allowed = getAllowedDirs();
    const contained = allowed.some((dir) => {
        return real === dir || real.startsWith(dir + sep);
    });
    if (!contained) {
        throw new Error(
            `Access denied: ${filePath} resolves to ${real} which is outside allowed directories. ` +
            `Allowed: ${allowed.join(", ")}`
        );
    }

    // Check file type
    const stat = statSync(real);
    if (stat.isDirectory()) return real; // directories allowed for listing
    if (!stat.isFile()) {
        throw new Error(`Not a regular file: ${real} (${stat.isSymbolicLink() ? "symlink" : "special"})`);
    }

    // Size check
    if (stat.size > MAX_FILE_SIZE) {
        throw new Error(`File too large: ${real} (${(stat.size / 1024 / 1024).toFixed(1)}MB, max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
    }

    // Binary detection (check first 8KB for null bytes)
    const fd = readFileSync(real, { encoding: null, flag: "r" });
    const checkLen = Math.min(fd.length, 8192);
    for (let i = 0; i < checkLen; i++) {
        if (fd[i] === 0) {
            throw new Error(`Binary file detected: ${real} (null byte at offset ${i})`);
        }
    }

    return real;
}

/**
 * Validate path for write (creates parent dirs check, but does NOT require file to exist).
 */
export function validateWritePath(filePath) {
    if (!filePath) throw new Error("Empty file path");

    const abs = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);

    // For write, the file might not exist yet — validate the parent directory
    let checkPath = abs;
    if (!existsSync(abs)) {
        const parent = resolve(abs, "..");
        if (!existsSync(parent)) {
            // Parent doesn't exist either — will be created by write_file
            // Validate grandparent to ensure we're in allowed dirs
            let ancestor = resolve(parent, "..");
            while (!existsSync(ancestor) && ancestor !== resolve(ancestor, "..")) {
                ancestor = resolve(ancestor, "..");
            }
            checkPath = ancestor;
        } else {
            checkPath = parent;
        }
    }

    let real;
    try {
        real = realpathSync(checkPath);
    } catch {
        real = resolve(checkPath);
    }

    const allowed = getAllowedDirs();
    const contained = allowed.some((dir) => {
        return real === dir || real.startsWith(dir + sep);
    });
    if (!contained) {
        throw new Error(
            `Access denied: ${filePath} resolves to ${real} which is outside allowed directories`
        );
    }

    return abs;
}
