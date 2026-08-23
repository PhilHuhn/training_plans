import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import nodemailer from "nodemailer";
import { env } from "@/server/env";
import { emailAddress } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE = 5000;
const MAX_NAME = 200;

// A single-instance memory bucket. Enough to blunt a script hammering the form;
// it is not a defence against a distributed flood, and it resets on redeploy.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > RATE_LIMIT;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte versuche es später erneut." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const { name, email, message, website } = (body ?? {}) as Record<string, unknown>;

  // Honeypot: a field hidden from people. Anything filling it is a bot, so the
  // request is accepted silently rather than telling it what gave it away.
  if (typeof website === "string" && website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  if (typeof name !== "string" || name.trim().length < 2 || name.length > MAX_NAME) {
    return NextResponse.json({ error: "Bitte gib deinen Namen an." }, { status: 400 });
  }
  if (typeof email !== "string" || !isEmail(email)) {
    return NextResponse.json(
      { error: "Bitte gib eine gültige E-Mail-Adresse an." },
      { status: 400 },
    );
  }
  if (
    typeof message !== "string" ||
    message.trim().length < 10 ||
    message.length > MAX_MESSAGE
  ) {
    return NextResponse.json(
      { error: "Bitte schreibe eine Nachricht mit mindestens 10 Zeichen." },
      { status: 400 },
    );
  }

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    // Say so plainly. A form that pretends to have sent a message nobody will
    // ever read is worse than one that admits it cannot deliver.
    console.error("[contact] SMTP is not configured — message not delivered");
    return NextResponse.json(
      {
        error:
          "Der Nachrichtenversand ist derzeit nicht eingerichtet. Bitte schreibe stattdessen direkt eine E-Mail.",
      },
      { status: 503 },
    );
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });

  try {
    await transporter.sendMail({
      // The envelope sender stays our own account — sending as the visitor
      // would fail SPF and land in spam. Their address goes in Reply-To.
      from: `"Turbine Turmweg Kontakt" <${env.SMTP_USER}>`,
      to: env.CONTACT_TO || emailAddress,
      replyTo: `"${name.trim()}" <${email.trim()}>`,
      subject: `Kontaktformular: ${name.trim()}`,
      text: [
        `Name:    ${name.trim()}`,
        `E-Mail:  ${email.trim()}`,
        "",
        message.trim(),
      ].join("\n"),
    });
  } catch (err) {
    console.error("[contact] delivery failed:", err);
    return NextResponse.json(
      { error: "Die Nachricht konnte nicht zugestellt werden. Bitte versuche es später erneut." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
