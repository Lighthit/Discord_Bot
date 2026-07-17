import { tool } from '@openrouter/agent';
import { z } from 'zod';

export const getCurrentDateTool = tool({
  name: 'get_current_date',
  description: 'Get current server date/time.',
  inputSchema: z.object({
    format: z
      .enum(['iso', 'date_only', 'full'])
      .optional()
      .default('iso')
      .describe('iso=UTC ISO string, date_only=YYYY-MM-DD, full=readable local'),
  }),
  outputSchema: z.object({
    datetime: z.string().describe('Formatted date/time based on format'),
    timeZone: z.string().describe('Server IANA timezone'),
    timestamp: z.number().describe('Unix timestamp in ms'),
  }),
  execute: async ({ format }) => {
    const now = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    let result;
    switch (format) {
      case 'date_only':
        result = now.toLocaleDateString('en-CA', { timeZone: tz });
        break;
      case 'full':
        result = now.toLocaleString('en-US', { timeZone: tz, dateStyle: 'full', timeStyle: 'medium' });
        break;
      default:
        result = now.toISOString();
    }

    return { datetime: result, timeZone: tz, timestamp: now.getTime() };
  },
});