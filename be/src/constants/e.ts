import dotenv from "dotenv";
dotenv.config();

export const PORT = Number(process.env.PORT) || 3000;

export const isProd =
  process.env.NODE_ENV === "prod" || process.env.NODE_ENV === "production";

const FE_URL_PROD = (process.env.FE_URL_PROD || "").trim();
const FE_URL_DEV = (process.env.FE_URL_DEV || "http://localhost:5173").trim();

export const allowedOrigins = [FE_URL_DEV, FE_URL_PROD].filter(
  (origin) => origin.length > 0,
);

export const fe_url = isProd && FE_URL_PROD ? FE_URL_PROD : FE_URL_DEV;
export const resend_api_key = process.env.RESEND_API_KEY || "re_";
export const resend_from_email =
  process.env.RESEND_FROM_EMAIL || "Draw Wine <onboarding@resend.dev>";
export const gemini_api_key = process.env.GEMINI_API_KEY || "";

export const redis_url = process.env.REDIS_URL || "redis://localhost:6379";
export const jwt_secret = process.env.JWT_SECRET || "default_development_secret_do_not_use_in_prod";
export const treasury_wallet = process.env.TREASURY_WALLET_ADDRESS || "6U2V5fGjJ2XJz5V4hVwGqU5nF5V5x5Y2tG6P1f6N4t9k"; // dummy address for development
