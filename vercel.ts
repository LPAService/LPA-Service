import type { VercelConfig } from "@vercel/config/v1";

/**
 * Horário do sync diário, em UTC (a Vercel roda crons em UTC).
 * `0 9 * * *` = 06:00 no horário de Brasília (UTC-3).
 */
const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    {
      path: "/api/cron/sync",
      schedule: "0 9 * * *",
    },
  ],
};

export default config;
