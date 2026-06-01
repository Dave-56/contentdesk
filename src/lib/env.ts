import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_APP_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  CONTENTDESK_APP_URL: z.string().url().optional(),
  PARALLEL_API_KEY: z.string().optional(),
  AI_GATEWAY_API_KEY: z.string().optional(),
  CONTENTDESK_AI_MODEL: z.string().optional(),
  CONTENTDESK_IMAGE_MODEL: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
});

export function getEnv() {
  return envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
    SLACK_APP_TOKEN: process.env.SLACK_APP_TOKEN,
    SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET,
    CONTENTDESK_APP_URL: process.env.CONTENTDESK_APP_URL,
    PARALLEL_API_KEY: process.env.PARALLEL_API_KEY,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
    CONTENTDESK_AI_MODEL: process.env.CONTENTDESK_AI_MODEL,
    CONTENTDESK_IMAGE_MODEL: process.env.CONTENTDESK_IMAGE_MODEL,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  });
}
