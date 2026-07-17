import { tool } from '@openrouter/agent';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Expected folder layout:
 *   ./jobs/<uniqueId>/<csvFileName>
 *
 * This tool manages the URL list inside that CSV file:
 *   - add    : append a new URL (skips if it already exists)
 *   - remove : delete a URL from the list
 *   - edit   : replace an existing URL with a new one
 *
 * If the CSV file does not exist yet, it will be created automatically
 * (using the default name "certificate-web.csv" unless a different
 * csvFileName is provided) the first time action "add" is used.
 */

const DEFAULT_CSV_NAME = 'certificate-web.csv';
const DEFAULT_HEADER = 'url';

function getFilePath(uniqueId, csvFileName) {
  const folder = path.join('.', 'jobs', uniqueId);
  const filePath = path.join(folder, csvFileName);
  return { folder, filePath };
}

function readLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf-8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function isHeaderLine(line) {
  return /^(url|website|link)$/i.test(line);
}

function normalizeUrl(url) {
  // Same-column-cleanup logic as the CSV reader used by check_certificates,
  // so entries stay consistent between the two tools.
  return url.split(',')[0].replace(/^"|"$/g, '').trim();
}

/**
 * Produces a comparison key that treats "example.com", "http://example.com",
 * and "https://example.com" (with or without a trailing slash) as the same URL.
 * Used only for duplicate/match checks — the original string is still what
 * gets stored in the CSV.
 */
function canonicalUrl(url) {
  return normalizeUrl(url)
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
}

function writeLines(filePath, lines) {
  const folder = path.dirname(filePath);
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
}

export const manageCertFileTool = tool({
  name: 'manageCertFileTool',
  description:
    'Adds, removes, or edits a URL entry inside ./jobs/{uniqueId}/{csvFileName}. ' +
    'Use action "add" to append a new URL (duplicates are skipped), "remove" to delete ' +
    'an existing URL, or "edit" to replace an existing URL with a new one. ' +
    '"https://example.com", "http://example.com", and "example.com" are treated as the ' +
    'same URL when checking for duplicates or matches — protocol and trailing slash are ignored. ' +
    'If the CSV file does not exist yet, action "add" will create it automatically ' +
    '(default filename "certificate-web.csv").',

  inputSchema: z.object({
    uniqueId: z.string().describe('Job id — targets ./jobs/{uniqueId}/{csvFileName}'),
    csvFileName: z.string().default(DEFAULT_CSV_NAME).describe('CSV filename in the job folder'),
    action: z.enum(['add', 'remove', 'edit']).describe('Which operation to perform'),
    url: z.string().describe('URL to add / remove / edit (the existing URL when action is "edit")'),
    newUrl: z.string().optional().describe('Required when action is "edit" — the URL to replace it with'),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
    action: z.string(),
    filePath: z.string(),
    fileCreated: z.boolean(),
    total: z.number(),
    message: z.string(),
  }),
  execute: async ({ uniqueId, csvFileName, action, url, newUrl }) => {
    const resolvedCsvFileName = csvFileName || DEFAULT_CSV_NAME;
    const { filePath } = getFilePath(uniqueId, resolvedCsvFileName);
    const target = normalizeUrl(url);

    if (action === 'edit' && !newUrl) {
      throw new Error('newUrl is required when action is "edit"');
    }

    const fileExistedBefore = fs.existsSync(filePath);

    if (!fileExistedBefore && action !== 'add') {
      throw new Error(
        `CSV file does not exist yet: ${filePath}. Use action "add" first to create it.`
      );
    }

    const existingLines = readLines(filePath);
    const header = existingLines.find(isHeaderLine) ?? (fileExistedBefore ? null : DEFAULT_HEADER);
    const entries = existingLines.filter((line) => !isHeaderLine(line));

    let message = '';
    let nextEntries = entries;

    switch (action) {
      case 'add': {
        const alreadyExists = entries.some((line) => canonicalUrl(line) === canonicalUrl(target));
        if (alreadyExists) {
          message = `URL already exists, skipped: ${target}`;
          nextEntries = entries;
        } else {
          nextEntries = [...entries, target];
          message = fileExistedBefore
            ? `Added: ${target}`
            : `Created ${resolvedCsvFileName} and added: ${target}`;
        }
        break;
      }

      case 'remove': {
        const exists = entries.some((line) => canonicalUrl(line) === canonicalUrl(target));
        if (!exists) {
          throw new Error(`URL not found in CSV: ${target}`);
        }
        nextEntries = entries.filter((line) => canonicalUrl(line) !== canonicalUrl(target));
        message = `Removed: ${target}`;
        break;
      }

      case 'edit': {
        const cleanNewUrl = normalizeUrl(newUrl);
        const exists = entries.some((line) => canonicalUrl(line) === canonicalUrl(target));
        if (!exists) {
          throw new Error(`URL not found in CSV: ${target}`);
        }
        const newUrlCollides = entries.some(
          (line) =>
            canonicalUrl(line) === canonicalUrl(cleanNewUrl) &&
            canonicalUrl(line) !== canonicalUrl(target)
        );
        if (newUrlCollides) {
          throw new Error(`newUrl already exists in CSV: ${cleanNewUrl}`);
        }
        nextEntries = entries.map((line) =>
          canonicalUrl(line) === canonicalUrl(target) ? cleanNewUrl : line
        );
        message = `Edited: ${target} -> ${cleanNewUrl}`;
        break;
      }
    }

    const finalLines = header ? [header, ...nextEntries] : nextEntries;
    writeLines(filePath, finalLines);

    return {
      ok: true,
      action,
      filePath,
      fileCreated: !fileExistedBefore,
      total: nextEntries.length,
      message,
    };
  },
});