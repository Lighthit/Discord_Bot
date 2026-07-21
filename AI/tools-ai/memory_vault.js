import fs from 'node:fs/promises';
import path from 'node:path';
import { tool } from '@openrouter/agent';
import { z } from 'zod';

/* =========================================================
 * CONFIG
 * ========================================================= */

const JOB_ROOT = './jobs';
const VAULT_DIRNAME = 'memory_vault';

/* =========================================================
 * SCHEMAS — เขียนแบบเดียวกับ checkCertificatesTool
 * (plain z.object เท่านั้น ไม่มี .superRefine()/discriminatedUnion
 * ที่ระดับนี้ เพราะตัวแปลง JSON Schema ของ framework อ่าน .shape
 * ตรง ๆ ถ้าเจอ ZodEffects/ZodDiscriminatedUnion บางเวอร์ชันจะ throw
 * "Invalid Zod schema provided")
 * ========================================================= */

const inputSchema = z.object({
  unique_id: z.string().describe('รหัสงาน ใช้กำหนดโฟลเดอร์ ./job/{unique_id}/memory_vault'),
  action: z
    .enum(['create', 'read', 'update', 'delete', 'list', 'search', 'backlinks'])
    .describe('การกระทำที่ต้องการ'),
  note_path: z
    .string()
    .optional()
    .describe(
      'ชื่อ/พาธของโน้ต เช่น "projects/idea-a" (ไม่ต้องใส่ .md) — จำเป็นสำหรับ read/update/delete/backlinks. ' +
        'สำหรับ action=create ถ้าไม่ระบุ ระบบจะสร้างให้อัตโนมัติจาก title+วันที่ ' +
        'ห้ามใช้ชื่อกำกวมเช่น "today"/"note"/"untitled" — ให้ตั้งชื่อที่สื่อเนื้อหา เช่น "tasks/2026-07-22-depa-meeting"'
    ),
  title: z.string().optional().describe('ชื่อเรื่องของโน้ต'),
  content: z.string().optional().describe('เนื้อหา Markdown ของโน้ต'),
  tags: z.array(z.string()).optional().describe('แท็กของโน้ต เช่น ["idea", "todo"]'),
  query: z.string().optional().describe('คำค้นหา ใช้กับ action=search (จำเป็นเมื่อ action=search)'),
  append: z.boolean().optional().default(false).describe('ถ้า true และ action=update จะต่อท้ายเนื้อหาเดิมแทนการเขียนทับ'),
});

const outputSchema = z.object({
  ok: z.boolean(),
  action: z.string(),
  path: z.string().nullable(),
  title: z.string().nullable(),
  content: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  links: z.array(z.string()).nullable(),
  count: z.number().nullable(),
  notes: z
    .array(
      z.object({
        path: z.string(),
        title: z.string().nullable(),
        tags: z.array(z.string()),
        updated: z.string().nullable(),
      })
    )
    .nullable(),
  error: z.string().nullable(),
});

/* =========================================================
 * HELPERS
 * ========================================================= */

function vaultDir(uniqueId) {
  return path.join(JOB_ROOT, uniqueId, VAULT_DIRNAME);
}

function safeNoteFile(uniqueId, notePath) {
  if (!notePath || notePath.startsWith('.') || notePath.includes('..')) {
    throw new Error('invalid note_path');
  }
  const base = vaultDir(uniqueId);
  const resolved = path.resolve(base, `${notePath}.md`);
  if (!resolved.startsWith(path.resolve(base) + path.sep) && resolved !== path.resolve(base)) {
    throw new Error('note_path escapes vault directory');
  }
  return resolved;
}

function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, '') // เก็บตัวอักษร + วรรณยุกต์/สระ (รองรับไทย) + ตัวเลข + ช่องว่าง + -
    .replace(/\s+/g, '-')
    .slice(0, 60)
    .replace(/-+$/, '');
}

function generateNotePath(title) {
  const datePrefix = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const slug = title ? slugify(title) : 'untitled';
  return `notes/${datePrefix}-${slug || 'untitled'}`;
}

function serializeNote({ title, tags, created, updated, content }) {
  const fm = [
    '---',
    `title: ${title ?? ''}`,
    `tags: [${(tags ?? []).join(', ')}]`,
    `created: ${created}`,
    `updated: ${updated}`,
    '---',
    '',
  ].join('\n');
  return fm + (content ?? '');
}

function parseNote(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { title: undefined, tags: [], created: undefined, updated: undefined, body: raw };
  }
  const [, fmBlock, body] = match;
  const meta = {};
  for (const line of fmBlock.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key === 'tags') {
      meta.tags = value
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    } else {
      meta[key] = value;
    }
  }
  return {
    title: meta.title || undefined,
    tags: meta.tags ?? [],
    created: meta.created || undefined,
    updated: meta.updated || undefined,
    body: body ?? '',
  };
}

function extractLinks(body) {
  const wiki = [...body.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim());
  const md = [...body.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
    .map((m) => m[1].trim())
    .filter((l) => !/^https?:\/\//i.test(l))
    .map((l) => l.replace(/\.md$/, ''));
  return [...new Set([...wiki, ...md])];
}

async function walkNotes(baseDir) {
  const out = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        out.push(full);
      }
    }
  }
  await walk(baseDir);
  return out;
}

function toNotePath(baseDir, filePath) {
  return path.relative(baseDir, filePath).replace(/\.md$/, '').split(path.sep).join('/');
}

/* =========================================================
 * TOOL
 * ========================================================= */

export const memoryVaultTool = tool({
  name: 'memory_vault',
  description:
    'Manages Markdown notes in ./job/{unique_id}/memory_vault. Supports create, read, ' +
    'update, delete, list, search, and backlinks. Notes support YAML-style frontmatter ' +
    '(title, tags) and [[wiki links]] or markdown links for backlink tracking.',
  inputSchema,
  outputSchema,
  execute: async (input) => {
    const { unique_id, action, note_path, title, content, tags, query, append } = input;

    // --- manual cross-field validation (แทน .superRefine ที่ทำให้ schema convert พัง) ---
    const needsNotePath = ['read', 'update', 'delete', 'backlinks']; // 'create' ไม่บังคับแล้ว เพราะ auto-generate ได้
    if (needsNotePath.includes(action) && !note_path) {
      return {
        ok: false,
        action,
        path: null,
        title: null,
        content: null,
        tags: null,
        links: null,
        count: null,
        notes: null,
        error: `note_path is required when action="${action}"`,
      };
    }
    if (action === 'search' && !query) {
      return {
        ok: false,
        action,
        path: null,
        title: null,
        content: null,
        tags: null,
        links: null,
        count: null,
        notes: null,
        error: 'query is required when action="search"',
      };
    }

    const base = vaultDir(unique_id);

    try {
      await fs.mkdir(base, { recursive: true });

      switch (action) {
        case 'create': {
          const resolvedNotePath = note_path || generateNotePath(title);
          const file = safeNoteFile(unique_id, resolvedNotePath);
          await fs.mkdir(path.dirname(file), { recursive: true });
          const now = new Date().toISOString();
          const raw = serializeNote({ title, tags, created: now, updated: now, content: content ?? '' });
          await fs.writeFile(file, raw, { flag: 'wx' }).catch(async (err) => {
            if (err.code === 'EEXIST') throw new Error(`note already exists at "${resolvedNotePath}"`);
            throw err;
          });
          return {
            ok: true,
            action,
            path: resolvedNotePath,
            title: title ?? null,
            content: content ?? '',
            tags: tags ?? [],
            links: extractLinks(content ?? ''),
            count: null,
            notes: null,
            error: null,
          };
        }

        case 'read': {
          const file = safeNoteFile(unique_id, note_path);
          const raw = await fs.readFile(file, 'utf8');
          const parsed = parseNote(raw);
          return {
            ok: true,
            action,
            path: note_path,
            title: parsed.title ?? null,
            content: parsed.body,
            tags: parsed.tags,
            links: extractLinks(parsed.body),
            count: null,
            notes: null,
            error: null,
          };
        }

        case 'update': {
          const file = safeNoteFile(unique_id, note_path);
          const raw = await fs.readFile(file, 'utf8');
          const parsed = parseNote(raw);
          const newBody = append ? parsed.body + '\n' + (content ?? '') : content ?? parsed.body;
          const newTitle = title ?? parsed.title;
          const newTags = tags ?? parsed.tags;
          const out = serializeNote({
            title: newTitle,
            tags: newTags,
            created: parsed.created ?? new Date().toISOString(),
            updated: new Date().toISOString(),
            content: newBody,
          });
          await fs.writeFile(file, out);
          return {
            ok: true,
            action,
            path: note_path,
            title: newTitle ?? null,
            content: newBody,
            tags: newTags,
            links: extractLinks(newBody),
            count: null,
            notes: null,
            error: null,
          };
        }

        case 'delete': {
          const file = safeNoteFile(unique_id, note_path);
          await fs.unlink(file);
          return {
            ok: true,
            action,
            path: note_path,
            title: null,
            content: null,
            tags: null,
            links: null,
            count: null,
            notes: null,
            error: null,
          };
        }

        case 'list': {
          const files = await walkNotes(base);
          const notes = await Promise.all(
            files.map(async (f) => {
              const raw = await fs.readFile(f, 'utf8');
              const parsed = parseNote(raw);
              return {
                path: toNotePath(base, f),
                title: parsed.title ?? null,
                tags: parsed.tags,
                updated: parsed.updated ?? null,
              };
            })
          );
          return {
            ok: true,
            action,
            path: null,
            title: null,
            content: null,
            tags: null,
            links: null,
            count: notes.length,
            notes,
            error: null,
          };
        }

        case 'search': {
          const files = await walkNotes(base);
          const q = query.toLowerCase();
          const matches = [];
          for (const f of files) {
            const raw = await fs.readFile(f, 'utf8');
            const parsed = parseNote(raw);
            const haystack = `${parsed.title ?? ''}\n${parsed.body}\n${parsed.tags.join(' ')}`.toLowerCase();
            if (haystack.includes(q)) {
              matches.push({
                path: toNotePath(base, f),
                title: parsed.title ?? null,
                tags: parsed.tags,
                updated: parsed.updated ?? null,
              });
            }
          }
          return {
            ok: true,
            action,
            path: null,
            title: null,
            content: null,
            tags: null,
            links: null,
            count: matches.length,
            notes: matches,
            error: null,
          };
        }

        case 'backlinks': {
          const files = await walkNotes(base);
          const target = note_path.replace(/\.md$/, '');
          const backlinks = [];
          for (const f of files) {
            const notePathHere = toNotePath(base, f);
            if (notePathHere === target) continue;
            const raw = await fs.readFile(f, 'utf8');
            const parsed = parseNote(raw);
            const links = extractLinks(parsed.body);
            if (links.some((l) => l === target || l.endsWith('/' + target))) {
              backlinks.push({
                path: notePathHere,
                title: parsed.title ?? null,
                tags: parsed.tags,
                updated: parsed.updated ?? null,
              });
            }
          }
          return {
            ok: true,
            action,
            path: note_path,
            title: null,
            content: null,
            tags: null,
            links: null,
            count: backlinks.length,
            notes: backlinks,
            error: null,
          };
        }

        default:
          return {
            ok: false,
            action,
            path: null,
            title: null,
            content: null,
            tags: null,
            links: null,
            count: null,
            notes: null,
            error: `unknown action "${action}"`,
          };
      }
    } catch (err) {
      return {
        ok: false,
        action,
        path: note_path ?? null,
        title: null,
        content: null,
        tags: null,
        links: null,
        count: null,
        notes: null,
        error: err.message ?? String(err),
      };
    }
  },
});