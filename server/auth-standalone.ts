/**
 * Standalone authentication for Railway/self-hosted deployment.
 * Provides simple email/password auth when Manus OAuth is not available.
 * Uses bcrypt for password hashing and JWT for session tokens.
 */
import { SignJWT, jwtVerify } from "jose";
import type { Express, Request, Response } from "express";
import * as db from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const SESSION_COOKIE = "session";
const TOKEN_EXPIRY = "7d";

function getSecretKey() {
  return new TextEncoder().encode(JWT_SECRET);
}

export async function createSessionToken(userId: number, openId: string): Promise<string> {
  return new SignJWT({ sub: openId, userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<{ openId: string; userId: number } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return { openId: payload.sub as string, userId: payload.userId as number };
  } catch {
    return null;
  }
}

export function registerStandaloneAuthRoutes(app: Express) {
  // Login endpoint
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const user = await db.getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Simple password check (stored as bcrypt hash in passwordHash column)
    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(password, user.passwordHash || "");
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = await createSessionToken(user.id, user.openId);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });

  // Register endpoint (admin creates users, or first user becomes admin)
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const existing = await db.getUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 12);

    // Check if this is the first user (make them admin)
    const allUsers = await db.listUsers();
    const role = allUsers.length === 0 ? "admin" : "user";

    const openId = `local_${crypto.randomUUID()}`;
    await db.upsertUser({
      openId,
      name: name || email.split("@")[0],
      email,
      loginMethod: "email",
      lastSignedIn: new Date(),
    });

    // Store password hash
    const user = await db.getUserByEmail(email);
    if (user) {
      await db.updateUserPasswordHash(user.id, passwordHash);
      if (role === "admin") {
        await db.updateUserRole(user.id, "admin");
      }
    }

    res.json({ success: true, message: "Account created. Please log in." });
  });

  // Logout
  app.post("/api/auth/logout", (_req: Request, res: Response) => {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ success: true });
  });

  // Current user
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const token = req.cookies?.[SESSION_COOKIE] || req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      res.json({ user: null });
      return;
    }
    const session = await verifySessionToken(token);
    if (!session) {
      res.json({ user: null });
      return;
    }
    const user = await db.getUserByOpenId(session.openId);
    res.json({ user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null });
  });
}

/**
 * Middleware to authenticate requests in standalone mode.
 * Returns the user or null (same interface as Manus SDK).
 */
export async function authenticateStandalone(req: Request) {
  const token = req.cookies?.[SESSION_COOKIE] || req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  return db.getUserByOpenId(session.openId);
}

