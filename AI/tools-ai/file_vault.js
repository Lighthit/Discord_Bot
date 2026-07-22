import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { lookup as mimeLookup } from "mime-types";

import { tool } from "@openrouter/agent";
import { z } from "zod";

/* =========================================================
 * CONFIG
 * ========================================================= */

const JOB_ROOT = "./jobs";

const FILE_VAULT = "file_vault";

const FILE_DIR = "files";

const META_DIR = "metadata";

const THUMB_DIR = "thumbnail";

const TZ_OFFSET_HOURS = 7;

/* =========================================================
 * INPUT
 * ========================================================= */

const inputSchema = z.object({

    unique_id: z.string(),

    action: z.enum([
        "upload",
        "read",
        "update",
        "delete",
        "move",
        "rename",
        "list",
        "search",
        "info"
    ]),

    file_path: z.string().optional(),

    folder: z.string().optional(),

    filename: z.string().optional(),

    source_path: z.string().optional(),

    target_path: z.string().optional(),

    title: z.string().optional(),

    description: z.string().optional(),

    tags: z.array(z.string()).optional(),

    extracted_text: z.string().optional(),

    entities: z.record(z.any()).optional(),

    query: z.string().optional()

});

/* =========================================================
 * OUTPUT
 * ========================================================= */

const outputSchema = z.object({

    ok: z.boolean(),

    action: z.string(),

    path: z.string().nullable(),

    filename: z.string().nullable(),

    mime: z.string().nullable(),

    size: z.number().nullable(),

    hash: z.string().nullable(),

    metadata: z.record(z.any()).nullable(),

    files: z.array(

        z.object({

            path: z.string(),

            filename: z.string(),

            mime: z.string(),

            size: z.number(),

            tags: z.array(z.string())

        })

    ).nullable(),

    count: z.number().nullable(),

    error: z.string().nullable()

});

/* =========================================================
 * TIME
 * ========================================================= */

function nowThaiDate() {

    return new Date(
        Date.now() + TZ_OFFSET_HOURS * 60 * 60 * 1000
    );

}

function nowThaiISOString() {

    return nowThaiDate()
        .toISOString()
        .replace("Z", "+07:00");

}

/* =========================================================
 * PATH
 * ========================================================= */

function vaultDir(uniqueId) {

    return path.join(
        JOB_ROOT,
        uniqueId,
        FILE_VAULT
    );

}

function filesDir(uniqueId) {

    return path.join(
        vaultDir(uniqueId),
        FILE_DIR
    );

}

function metadataDir(uniqueId) {

    return path.join(
        vaultDir(uniqueId),
        META_DIR
    );

}

function thumbnailDir(uniqueId) {

    return path.join(
        vaultDir(uniqueId),
        THUMB_DIR
    );

}

/* =========================================================
 * SAFE PATH
 * ========================================================= */

function safeFile(uniqueId, filePath) {

    if (
        !filePath ||
        filePath.startsWith(".") ||
        filePath.includes("..")
    ) {

        throw new Error("invalid file path");

    }

    const base = filesDir(uniqueId);

    const resolved = path.resolve(
        base,
        filePath
    );

    if (
        !resolved.startsWith(
            path.resolve(base) + path.sep
        )
    ) {

        throw new Error("path escapes vault");

    }

    return resolved;

}

function safeMeta(uniqueId, filePath) {

    const file = safeFile(uniqueId, filePath);

    const relative = path.relative(
        filesDir(uniqueId),
        file
    );

    return path.join(
        metadataDir(uniqueId),
        relative + ".json"
    );

}

/* =========================================================
 * HELPERS
 * ========================================================= */

async function ensureVault(uniqueId) {

    await fs.mkdir(
        filesDir(uniqueId),
        { recursive: true }
    );

    await fs.mkdir(
        metadataDir(uniqueId),
        { recursive: true }
    );

    await fs.mkdir(
        thumbnailDir(uniqueId),
        { recursive: true }
    );

}

function relativeFile(uniqueId, file) {

    return path.relative(
        filesDir(uniqueId),
        file
    ).split(path.sep).join("/");

}

/* =========================================================
 * HASH
 * ========================================================= */

async function sha256(file) {

    return await new Promise((resolve, reject) => {

        const hash = crypto.createHash("sha256");

        const stream = fsSync.createReadStream(file);

        stream.on("data", chunk => {

            hash.update(chunk);

        });

        stream.on("end", () => {

            resolve(hash.digest("hex"));

        });

        stream.on("error", reject);

    });

}

/* =========================================================
 * MIME
 * ========================================================= */

function detectMime(file) {

    return mimeLookup(file)
        || "application/octet-stream";

}

/* =========================================================
 * METADATA
 * ========================================================= */

async function loadMetadata(uniqueId, filePath) {

    const meta = safeMeta(
        uniqueId,
        filePath
    );

    try {

        return JSON.parse(
            await fs.readFile(meta, "utf8")
        );

    } catch {

        return null;

    }

}

async function saveMetadata(
    uniqueId,
    filePath,
    data
) {

    const meta = safeMeta(
        uniqueId,
        filePath
    );

    await fs.mkdir(
        path.dirname(meta),
        { recursive: true }
    );

    await fs.writeFile(
        meta,
        JSON.stringify(
            data,
            null,
            2
        )
    );

}

/* =========================================================
 * DELETE EMPTY DIR
 * ========================================================= */

async function prune(dir, base) {

    while (true) {

        if (
            path.resolve(dir) ===
            path.resolve(base)
        ) {

            break;

        }

        let list;

        try {

            list = await fs.readdir(dir);

        } catch {

            break;

        }

        if (list.length) {

            break;

        }

        await fs.rmdir(dir);

        dir = path.dirname(dir);

    }

}

/* =========================================================
 * WALK FILES
 * ========================================================= */

async function walk(dir) {

    const result = [];

    async function loop(folder) {

        let entries = [];

        try {

            entries = await fs.readdir(
                folder,
                { withFileTypes: true }
            );

        } catch {

            return;

        }

        for (const entry of entries) {

            const full = path.join(
                folder,
                entry.name
            );

            if (entry.isDirectory()) {

                await loop(full);

            } else {

                result.push(full);

            }

        }

    }

    await loop(dir);

    return result;

}
/* =========================================================
 * PUBLIC HELPERS (ใช้จากภายนอกไฟล์นี้ เช่น discord bot)
 * ========================================================= */

export function vaultFilesDir(uniqueId) {

    return filesDir(uniqueId);

}

export function resolveVaultFile(uniqueId, filePath) {

    // reuse safeFile validation เดิม กัน path traversal
    return safeFile(uniqueId, filePath);

}

export async function readVaultFileBuffer(uniqueId, filePath) {

    const file = safeFile(uniqueId, filePath);

    return await fs.readFile(file);

}

/* =========================================================
 * TOOL
 * ========================================================= */

/**
 * Logic จริงของ file_vault แยกออกมาเป็นฟังก์ชันเปล่า ๆ
 * (ไม่ผูกกับ tool() wrapper) เพื่อให้เรียกใช้ตรง ๆ ได้
 * ทั้งจาก agent loop (ผ่าน fileVaultTool ด้านล่าง) และ
 * จากโค้ดอื่น เช่น discord bot ที่ต้องการอัปโหลด/อ่านไฟล์
 * โดยไม่ผ่าน callModel — tool() ไม่รับประกันว่า object ที่
 * คืนมาจะมี .execute เป็น function ที่เรียกตรงได้
 */
export async function runFileVaultAction(input) {

        const {

            unique_id,

            action,

            file_path,

            folder,

            filename,

            source_path,

            target_path,

            title,

            description,

            tags,

            extracted_text,

            entities,

            query

        } = input;

        try {

            await ensureVault(unique_id);

            switch (action) {

                /* =========================================================
                 * UPLOAD
                 * ========================================================= */

                case "upload": {

                    if (!source_path)
                        throw new Error("source_path required");

                    if (!filename)
                        throw new Error("filename required");

                    const relative = folder
                        ? path.posix.join(folder, filename)
                        : filename;

                    const destination = safeFile(
                        unique_id,
                        relative
                    );

                    await fs.mkdir(
                        path.dirname(destination),
                        { recursive: true }
                    );

                    await fs.copyFile(
                        source_path,
                        destination
                    );

                    const stat = await fs.stat(destination);

                    const hash = await sha256(destination);

                    const mime = detectMime(destination);

                    const metadata = {

                        title:
                            title ??
                            filename,

                        description:
                            description ?? "",

                        tags:
                            tags ?? [],

                        mime,

                        hash,

                        size: stat.size,

                        created: nowThaiISOString(),

                        updated: nowThaiISOString(),

                        extracted_text:
                            extracted_text ?? "",

                        entities:
                            entities ?? {}

                    };

                    await saveMetadata(
                        unique_id,
                        relative,
                        metadata
                    );

                    return {

                        ok: true,

                        action,

                        path: relative,

                        filename,

                        mime,

                        size: stat.size,

                        hash,

                        metadata,

                        files: null,

                        count: null,

                        error: null

                    };

                }

                /* =========================================================
                 * READ
                 * ========================================================= */

                case "read": {

                    if (!file_path)
                        throw new Error("file_path required");

                    const file = safeFile(
                        unique_id,
                        file_path
                    );

                    const stat = await fs.stat(file);

                    const hash = await sha256(file);

                    const mime = detectMime(file);

                    const metadata =
                        await loadMetadata(
                            unique_id,
                            file_path
                        );

                    return {

                        ok: true,

                        action,

                        path: file_path,

                        filename: path.basename(file),

                        mime,

                        size: stat.size,

                        hash,

                        metadata,

                        files: null,

                        count: null,

                        error: null

                    };

                }

                /* =========================================================
                 * INFO
                 * ========================================================= */

                case "info": {

                    if (!file_path)
                        throw new Error("file_path required");

                    const file = safeFile(
                        unique_id,
                        file_path
                    );

                    const stat = await fs.stat(file);

                    const metadata =
                        await loadMetadata(
                            unique_id,
                            file_path
                        );

                    return {

                        ok: true,

                        action,

                        path: file_path,

                        filename: path.basename(file),

                        mime: detectMime(file),

                        size: stat.size,

                        hash:
                            metadata?.hash ??
                            await sha256(file),

                        metadata,

                        files: null,

                        count: null,

                        error: null

                    };

                }
                /* =========================================================
                 * UPDATE METADATA
                 * ========================================================= */

                case "update": {

                    if (!file_path)
                        throw new Error("file_path required");

                    const file = safeFile(
                        unique_id,
                        file_path
                    );

                    await fs.access(file);

                    const metadata =
                        await loadMetadata(
                            unique_id,
                            file_path
                        ) ?? {};

                    if (title !== undefined)
                        metadata.title = title;

                    if (description !== undefined)
                        metadata.description = description;

                    if (tags !== undefined)
                        metadata.tags = tags;

                    if (extracted_text !== undefined)
                        metadata.extracted_text = extracted_text;

                    if (entities !== undefined)
                        metadata.entities = entities;

                    metadata.updated =
                        nowThaiISOString();

                    await saveMetadata(
                        unique_id,
                        file_path,
                        metadata
                    );

                    const stat =
                        await fs.stat(file);

                    return {

                        ok: true,

                        action,

                        path: file_path,

                        filename: path.basename(file),

                        mime: detectMime(file),

                        size: stat.size,

                        hash:
                            metadata.hash ??
                            await sha256(file),

                        metadata,

                        files: null,

                        count: null,

                        error: null

                    };

                }

                /* =========================================================
                 * DELETE
                 * ========================================================= */

                case "delete": {

                    if (!file_path)
                        throw new Error("file_path required");

                    const file = safeFile(
                        unique_id,
                        file_path
                    );

                    const meta = safeMeta(
                        unique_id,
                        file_path
                    );

                    try {

                        await fs.unlink(file);

                    } catch { }

                    try {

                        await fs.unlink(meta);

                    } catch { }

                    const thumb = path.join(

                        thumbnailDir(unique_id),

                        file_path

                    );

                    try {

                        await fs.unlink(thumb);

                    } catch { }

                    await prune(

                        path.dirname(file),

                        filesDir(unique_id)

                    );

                    await prune(

                        path.dirname(meta),

                        metadataDir(unique_id)

                    );

                    return {

                        ok: true,

                        action,

                        path: file_path,

                        filename: null,

                        mime: null,

                        size: null,

                        hash: null,

                        metadata: null,

                        files: null,

                        count: null,

                        error: null

                    };

                }

                /* =========================================================
                 * MOVE
                 * ========================================================= */

                case "move": {

                    if (!file_path)
                        throw new Error("file_path required");

                    if (!target_path)
                        throw new Error("target_path required");

                    const src = safeFile(

                        unique_id,

                        file_path

                    );

                    const dst = safeFile(

                        unique_id,

                        target_path

                    );

                    await fs.mkdir(

                        path.dirname(dst),

                        { recursive: true }

                    );

                    await fs.rename(

                        src,

                        dst

                    );

                    const metaSrc = safeMeta(

                        unique_id,

                        file_path

                    );

                    const metaDst = safeMeta(

                        unique_id,

                        target_path

                    );

                    await fs.mkdir(

                        path.dirname(metaDst),

                        { recursive: true }

                    );

                    try {

                        await fs.rename(

                            metaSrc,

                            metaDst

                        );

                    } catch { }

                    await prune(

                        path.dirname(src),

                        filesDir(unique_id)

                    );

                    await prune(

                        path.dirname(metaSrc),

                        metadataDir(unique_id)

                    );

                    const metadata =

                        await loadMetadata(

                            unique_id,

                            target_path

                        );

                    return {

                        ok: true,

                        action,

                        path: target_path,

                        filename: path.basename(dst),

                        mime: detectMime(dst),

                        size: (await fs.stat(dst)).size,

                        hash:
                            metadata?.hash ??
                            await sha256(dst),

                        metadata,

                        files: null,

                        count: null,

                        error: null

                    };

                }

                /* =========================================================
                 * RENAME
                 * ========================================================= */

                case "rename": {

                    if (!file_path)
                        throw new Error("file_path required");

                    if (!filename)
                        throw new Error("filename required");

                    const parent =

                        path.posix.dirname(file_path);

                    const target =

                        parent === "."

                            ? filename

                            : path.posix.join(

                                parent,

                                filename

                            );

                    const src = safeFile(

                        unique_id,

                        file_path

                    );

                    const dst = safeFile(

                        unique_id,

                        target

                    );

                    await fs.rename(

                        src,

                        dst

                    );

                    const metaSrc = safeMeta(

                        unique_id,

                        file_path

                    );

                    const metaDst = safeMeta(

                        unique_id,

                        target

                    );

                    try {

                        await fs.mkdir(

                            path.dirname(metaDst),

                            { recursive: true }

                        );

                        await fs.rename(

                            metaSrc,

                            metaDst

                        );

                    } catch { }

                    const metadata =

                        await loadMetadata(

                            unique_id,

                            target

                        );

                    return {

                        ok: true,

                        action,

                        path: target,

                        filename,

                        mime: detectMime(dst),

                        size: (await fs.stat(dst)).size,

                        hash:
                            metadata?.hash ??
                            await sha256(dst),

                        metadata,

                        files: null,

                        count: null,

                        error: null

                    };

                }/* =========================================================
 * LIST
 * ========================================================= */

                case "list": {

                    const all = await walk(
                        filesDir(unique_id)
                    );

                    const files = [];

                    for (const file of all) {

                        const relative = relativeFile(
                            unique_id,
                            file
                        );

                        const stat = await fs.stat(file);

                        const metadata =
                            await loadMetadata(
                                unique_id,
                                relative
                            );

                        files.push({

                            path: relative,

                            filename: path.basename(file),

                            mime: detectMime(file),

                            size: stat.size,

                            tags:
                                metadata?.tags ?? []

                        });

                    }

                    return {

                        ok: true,

                        action,

                        path: null,

                        filename: null,

                        mime: null,

                        size: null,

                        hash: null,

                        metadata: null,

                        files,

                        count: files.length,

                        error: null

                    };

                }

                /* =========================================================
                 * SEARCH
                 * ========================================================= */

                case "search": {

                    if (!query)
                        throw new Error(
                            "query required"
                        );

                    const all = await walk(
                        filesDir(unique_id)
                    );

                    const keyword =
                        query.toLowerCase();

                    const result = [];

                    for (const file of all) {

                        const relative =
                            relativeFile(
                                unique_id,
                                file
                            );

                        const metadata =
                            await loadMetadata(
                                unique_id,
                                relative
                            ) ?? {};

                        const stat =
                            await fs.stat(file);

                        const haystack = [

                            relative,

                            path.basename(file),

                            metadata.title,

                            metadata.description,

                            metadata.extracted_text,

                            ...(metadata.tags ?? []),

                            JSON.stringify(
                                metadata.entities ?? {}
                            )

                        ]
                            .join("\n")
                            .toLowerCase();

                        if (!haystack.includes(keyword))
                            continue;

                        result.push({

                            path: relative,

                            filename: path.basename(file),

                            mime: detectMime(file),

                            size: stat.size,

                            tags:
                                metadata.tags ?? []

                        });

                    }

                    return {

                        ok: true,

                        action,

                        path: null,

                        filename: null,

                        mime: null,

                        size: null,

                        hash: null,

                        metadata: null,

                        files: result,

                        count: result.length,

                        error: null

                    };

                }

                /* =========================================================
                 * DEFAULT
                 * ========================================================= */

                default:

                    return {

                        ok: false,

                        action,

                        path: null,

                        filename: null,

                        mime: null,

                        size: null,

                        hash: null,

                        metadata: null,

                        files: null,

                        count: null,

                        error:
                            `unknown action "${action}"`

                    };

            }

        } catch (err) {

            return {

                ok: false,

                action,

                path: file_path ?? null,

                filename: null,

                mime: null,

                size: null,

                hash: null,

                metadata: null,

                files: null,

                count: null,

                error:
                    err.message ??
                    String(err)

            };

        }

}

export const fileVaultTool = tool({

    name: "file_vault",

    description:
        "Manage files inside ./jobs/{unique_id}/file_vault. Supports upload, read, update, delete, move, rename, list, search and info.",

    inputSchema,

    outputSchema,

    execute: runFileVaultAction,

});