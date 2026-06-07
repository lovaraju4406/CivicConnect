import express from "express";
import http from "http";
import { Server as SocketServer } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

dotenv.config();

import { testConnection } from "./config/db";
import { setIO } from "./utils/notify";
import { verifyToken } from "./utils/jwt";
import { errorHandler, notFound } from "./middleware/errorHandler";

import authRoutes         from "./routes/auth.routes";
import complaintsRoutes   from "./routes/complaints.routes";
import usersRoutes        from "./routes/users.routes";
import analyticsRoutes    from "./routes/analytics.routes";
import notificationsRoutes from "./routes/notifications.routes";

const app    = express();
const server = http.createServer(app);
const PORT   = parseInt(process.env.PORT || "3001");
const CLIENT = process.env.CLIENT_URL || "http://localhost:5173";

// ── Socket.io ──────────────────────────────────────────────────────────────
const io = new SocketServer(server, {
  cors: { origin: CLIENT, methods: ["GET","POST"] },
});
setIO(io);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("No token"));
  try {
    const user = verifyToken(token);
    (socket as any).user = user;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", socket => {
  const user = (socket as any).user;
  if (user) {
    socket.join(`user:${user.id}`);
    socket.join(`role:${user.role}`);
    console.log(`🔌 Socket connected: ${user.email} (${user.role})`);
  }
  socket.on("disconnect", () => {
    if (user) console.log(`🔌 Socket disconnected: ${user.email}`);
  });
});

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: CLIENT, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve uploaded files
app.use("/uploads", express.static(path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads")));

// Rate limiting
// ── Rate Limiter — generous limits for polling dashboards ──────────────────
// Dashboards poll every 10-30s. With 4 roles open = ~24 req/min = 360/15min.
// Set 2000 per 15 min to allow normal usage without hitting limit.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { success: false, message: "Too many requests — please wait a moment" },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks
  skip: (req) => req.path === "/api/health",
});
app.use("/api", limiter);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { success: false, message: "Too many login attempts" }, standardHeaders: true, legacyHeaders: false });
app.use("/api/auth/login",    authLimiter);
app.use("/api/auth/register", authLimiter);

// ── Routes ─────────────────────────────────────────────────────────────────
app.use("/api/auth",          authRoutes);
app.use("/api/complaints",    complaintsRoutes);
app.use("/api/users",         usersRoutes);
app.use("/api/analytics",     analyticsRoutes);
app.use("/api/notifications", notificationsRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

// ── Error handling ─────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────
async function start() {
  await testConnection();
  server.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 Socket.io ready`);
    console.log(`🌐 Allowing CORS from: ${CLIENT}`);
    console.log(`\n📋 API Endpoints:`);
    console.log(`   POST   /api/auth/register`);
    console.log(`   POST   /api/auth/login`);
    console.log(`   GET    /api/auth/me`);
    console.log(`   GET    /api/complaints`);
    console.log(`   POST   /api/complaints`);
    console.log(`   POST   /api/complaints/:id/assign`);
    console.log(`   GET    /api/analytics/summary`);
    console.log(`   GET    /api/notifications`);
    console.log(`   GET    /api/health\n`);
  });
}

start().catch(err => { console.error("Failed to start server:", err); process.exit(1); });