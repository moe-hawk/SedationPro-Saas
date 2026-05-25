import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  SAAS_WEB_ORIGIN: z.string().url().default('http://localhost:5174'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('8h'),
  ENABLE_DEV_LOGIN: z.coerce.boolean().default(false),
  FIREBASE_PROJECT_ID: z.string().optional().default(''),
  FIREBASE_CLIENT_EMAIL: z.string().optional().default(''),
  FIREBASE_PRIVATE_KEY: z.string().optional().default(''),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  STRIPE_PRICE_SOLO: z.string().optional().default(''),
  STRIPE_PRICE_CLINIC: z.string().optional().default(''),
  STRIPE_SUCCESS_URL: z.string().url().default('http://localhost:5174/billing?checkout=success'),
  STRIPE_CANCEL_URL: z.string().url().default('http://localhost:5174/billing?checkout=cancelled'),
});

export const env = envSchema.parse(process.env);
export const isProduction = process.env.NODE_ENV === 'production';
