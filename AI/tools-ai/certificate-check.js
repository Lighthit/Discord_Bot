import { tool } from '@openrouter/agent';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import dns from 'node:dns/promises';
/**
 * Reads a CSV file that contains one certificate URL per line
 * (with or without a header row) and returns a clean list of URLs.
 *
 * Expected folder layout:
 *   ./jobs/<uniqueId>/<csvFileName>
 */
function readUrlsFromCsv(uniqueId, csvFileName) {
  const folder = path.join('.', 'jobs', uniqueId);
  const filePath = path.join(folder, csvFileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');

  const urls = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    // drop a possible header row like "url" / "URL" / "website"
    .filter((line) => !/^(url|website|link)$/i.test(line))
    // in case the CSV has trailing commas/quotes, just take the first column
    .map((line) => line.split(',')[0].replace(/^"|"$/g, '').trim());

  return urls;
}

/**
 * Extracts a bare hostname from a URL string.
 * Accepts values with or without a protocol, e.g. "example.com" or "https://example.com/path".
 */
function extractHostname(url) {
  try {
    const withProtocol = url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `https://${url}`;
    return new URL(withProtocol).hostname;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
}

/**
 * geting Ip in each website
 */
async function resolveIp(hostname) {
  try {
    const result = await dns.lookup(hostname);
    return result.address;
  } catch {
    return null;
  }
}
/**
 * Opens a TLS connection to the given hostname on port 443 and reads back
 * the peer certificate's validity window.
 */
function getCertificateInfo(hostname, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: hostname,
        port: 443,
        servername: hostname, // required for SNI
        rejectUnauthorized: false, // we want to inspect the cert even if the chain has issues
        timeout: timeoutMs,
      },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();

        if (!cert || Object.keys(cert).length === 0) {
          reject(new Error(`No certificate returned by ${hostname}`));
          return;
        }

        const now = Date.now();
        const validFrom = new Date(cert.valid_from);
        const validTo = new Date(cert.valid_to);
        const daysRemaining = Math.floor((validTo.getTime() - now) / (1000 * 60 * 60 * 24));

        resolve({
          valid: now >= validFrom.getTime() && now <= validTo.getTime(),
          daysRemaining,
          validFrom: validFrom.toISOString(),
          validTo: validTo.toISOString(),
          issuer: cert.issuer?.O || cert.issuer?.CN || 'Unknown',
        });
      }
    );

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`Connection to ${hostname} timed out`));
    });

    socket.on('error', (err) => {
      reject(new Error(`Could not connect to ${hostname}: ${err.message}`));
    });
  });
}

export const checkCertificatesTool = tool({
  name: 'check_certificates',
  description:
    'Checks SSL certificate validity and DNS info for websites listed in ' +
    './jobs/{uniqueId}/{csvFileName} (one URL per line). Returns hostname, IP, ' +
    'expiry, and issuer per URL. Use onlyUrl to check a single URL instead.',
  inputSchema: z.object({
    uniqueId: z.string().describe('Job id — reads ./jobs/{uniqueId}/{csvFileName}'),
    csvFileName: z.string().default('certificate-web.csv').describe('CSV filename in the job folder'),
    onlyUrl: z.string().optional().describe('Check only this URL instead of the whole CSV'),
  }),
  outputSchema: z.object({
    checkedAt: z.string(),
    total: z.number(),
    results: z.array(
      z.object({
        url: z.string(),
        hostname: z.string(),
        ip: z.string().nullable(),
        valid: z.boolean(),
        daysRemaining: z.number().nullable(),
        validFrom: z.string().nullable(),
        validTo: z.string().nullable(),
        error: z.string().nullable(),
      })
    ),
  }),
  execute: async ({ uniqueId, csvFileName, onlyUrl }) => {
    const urls = onlyUrl ? [onlyUrl] : readUrlsFromCsv(uniqueId, csvFileName);

    const results = await Promise.all(
      urls.map(async (url) => {
        let hostname = '';
        let ip = '';
        try {
          hostname = extractHostname(url);
          ip = await resolveIp(hostname);
          const info = await getCertificateInfo(hostname);
          return {
            url,
            hostname,
            ip,
            valid: info.valid,
            daysRemaining: info.daysRemaining,
            validFrom: info.validFrom,
            validTo: info.validTo,
            error: null,
          };
        } catch (err) {
          return {
            url,
            hostname,
            ip,
            valid: false,
            daysRemaining: null,
            validFrom: null,
            validTo: null,
            error: err.message ?? String(err),
          };
        }
      })
    );

    return {
      checkedAt: new Date().toISOString(),
      total: results.length,
      results,
    };
  },
});