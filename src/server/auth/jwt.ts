import "server-only";
import jwt from "jsonwebtoken";
import { env } from "@/server/env";

export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days, matches FastAPI

export interface TokenPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

export function signToken(userId: number | string): string {
  return jwt.sign({ sub: String(userId) }, env.SECRET_KEY, {
    algorithm: "HS256",
    expiresIn: TOKEN_TTL_SECONDS,
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, env.SECRET_KEY, { algorithms: ["HS256"] });
    if (typeof payload === "string" || !payload || typeof payload.sub !== "string") {
      return null;
    }
    return payload as TokenPayload;
  } catch {
    return null;
  }
}
