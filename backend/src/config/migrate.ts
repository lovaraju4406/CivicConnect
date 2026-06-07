import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

async function migrate() {
  // Connect without DB first to create it if needed
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || "localhost",
    port:     parseInt(process.env.DB_PORT || "3306"),
    user:     process.env.DB_USER     || "root",
    password: process.env.DB_PASSWORD || "",
  });

  const DB = process.env.DB_NAME || "smart_civic_db";
  console.log(`📦 Creating database "${DB}" if not exists...`);
  await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${DB}\``); 

  console.log("🏗️  Running migrations...");

  // ── USERS ──────────────────────────────────────────────────────────────────
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id            VARCHAR(36)  PRIMARY KEY,
      name          VARCHAR(120) NOT NULL,
      email         VARCHAR(180) NOT NULL UNIQUE,
      phone         VARCHAR(15),
      password_hash VARCHAR(255) NOT NULL,
      role          ENUM('citizen','officer','worker','admin') NOT NULL DEFAULT 'citizen',
      district      VARCHAR(80),
      department    VARCHAR(100),
      badge_number  VARCHAR(40),
      employee_id   VARCHAR(40),
      designation   VARCHAR(100),
      is_active     TINYINT(1)   NOT NULL DEFAULT 1,
      created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_users_role  (role),
      INDEX idx_users_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log("  ✅ users");

  // ── COMPLAINTS ─────────────────────────────────────────────────────────────
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS complaints (
      id            VARCHAR(36)   PRIMARY KEY,
      ticket_id     VARCHAR(20)   NOT NULL UNIQUE,
      title         VARCHAR(255)  NOT NULL,
      description   TEXT          NOT NULL,
      department    VARCHAR(100)  NOT NULL,
      lat           DECIMAL(10,7) NOT NULL DEFAULT 0,
      lng           DECIMAL(10,7) NOT NULL DEFAULT 0,
      address       VARCHAR(500)  NOT NULL,
      image_url     VARCHAR(500),
      status        ENUM('Pending','Assigned','Resolved') NOT NULL DEFAULT 'Pending',
      is_emergency  TINYINT(1)    NOT NULL DEFAULT 0,
      emergency_reason VARCHAR(500),
      user_id       VARCHAR(36)   NOT NULL,
      assigned_to   VARCHAR(36),
      assigned_at   DATETIME,
      resolved_at   DATETIME,
      resolved_by   VARCHAR(36),
      proof_image   VARCHAR(500),
      resolution_note TEXT,
      rating        TINYINT,
      rating_comment TEXT,
      rated_at      DATETIME,
      created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_complaints_status     (status),
      INDEX idx_complaints_dept       (department),
      INDEX idx_complaints_user       (user_id),
      INDEX idx_complaints_assigned   (assigned_to),
      INDEX idx_complaints_emergency  (is_emergency),
      INDEX idx_complaints_created    (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log("  ✅ complaints");

  // ── ASSIGNMENTS ────────────────────────────────────────────────────────────
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS assignments (
      id            VARCHAR(36) PRIMARY KEY,
      complaint_id  VARCHAR(36) NOT NULL,
      assigned_to   VARCHAR(36) NOT NULL,
      assigned_by   VARCHAR(36) NOT NULL,
      notes         TEXT,
      assigned_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at  DATETIME,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to)  REFERENCES users(id)      ON DELETE CASCADE,
      FOREIGN KEY (assigned_by)  REFERENCES users(id)      ON DELETE CASCADE,
      INDEX idx_assign_complaint (complaint_id),
      INDEX idx_assign_worker    (assigned_to)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log("  ✅ assignments");

  // ── NOTIFICATIONS ──────────────────────────────────────────────────────────
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id          VARCHAR(36)  PRIMARY KEY,
      user_id     VARCHAR(36)  NOT NULL,
      message     TEXT         NOT NULL,
      type        ENUM('info','success','warning','error') NOT NULL DEFAULT 'info',
      related_id  VARCHAR(36),
      is_read     TINYINT(1)   NOT NULL DEFAULT 0,
      created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_notif_user   (user_id),
      INDEX idx_notif_read   (is_read),
      INDEX idx_notif_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log("  ✅ notifications");

  await conn.end();
  console.log("\n🎉 Migration complete!");
}

migrate().catch(err => { console.error("Migration failed:", err); process.exit(1); });
