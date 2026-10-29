import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().url().default("mongodb://127.0.0.1:27017/worksphere"),
  WEB_ORIGINS: z.string().default("http://localhost:5173"),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment configuration:", parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsedEnv.data,
  webOrigins: parsedEnv.data.WEB_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
};
