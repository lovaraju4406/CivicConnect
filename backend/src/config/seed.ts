import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import dotenv from "dotenv";
dotenv.config();

async function seed() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || "localhost",
    port:     parseInt(process.env.DB_PORT || "3306"),
    user:     process.env.DB_USER     || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME     || "smart_civic_db",
  });

  console.log("🌱 Seeding database...");

  const hash = (p: string) => bcrypt.hashSync(p, 10);

  const users = [
    { id: uuid(), name: "Admin User",       email: "admin@civic.ap.gov.in",   phone: "9000000001", role: "admin",   department: "General Civic",           district: "Vijayawada" },
    { id: uuid(), name: "Ravi Kumar",        email: "officer@civic.ap.gov.in", phone: "9000000002", role: "officer", department: "Roads & Infrastructure",   district: "Guntur",     badge_number: "AP-OFF-001" },
    { id: uuid(), name: "Suresh Babu",       email: "worker@civic.ap.gov.in",  phone: "9000000003", role: "worker",  department: "Roads & Infrastructure",   district: "Guntur",     employee_id: "AP-WRK-001" },
    { id: uuid(), name: "Lakshmi Devi",      email: "citizen@civic.ap.gov.in", phone: "9000000004", role: "citizen", department: null,                       district: "Vijayawada" },
    { id: uuid(), name: "Venkat Reddy",      email: "officer2@civic.ap.gov.in",phone: "9000000005", role: "officer", department: "Water Works",              district: "Vijayawada", badge_number: "AP-OFF-002" },
    { id: uuid(), name: "Prasad Rao",        email: "worker2@civic.ap.gov.in", phone: "9000000006", role: "worker",  department: "Electricity",              district: "Vijayawada", employee_id: "AP-WRK-002" },
  ];

  for (const u of users) {
    await conn.execute(
      `INSERT IGNORE INTO users (id,name,email,phone,password_hash,role,district,department,badge_number,employee_id)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [u.id, u.name, u.email, u.phone, hash("password123"), u.role, u.district ?? null, u.department ?? null, (u as any).badge_number ?? null, (u as any).employee_id ?? null]
    );
  }
  console.log(`  ✅ ${users.length} users seeded`);

  // Seed sample complaints
  const citizenRow = await conn.execute(`SELECT id FROM users WHERE role='citizen' LIMIT 1`) as any;
  const citizenId  = citizenRow[0][0]?.id;
  const workerRow  = await conn.execute(`SELECT id FROM users WHERE role='worker' LIMIT 1`) as any;
  const workerId   = workerRow[0][0]?.id;

  if (citizenId) {
    const complaints = [
      { dept: "Roads & Infrastructure", title: "Large pothole on MG Road",           addr: "MG Road, Vijayawada", status: "Pending",  lat: 16.5062, lng: 80.6480 },
      { dept: "Water Works",            title: "Water pipe leakage near bus stand",   addr: "Pandit Nehru Bus Stand", status: "Assigned", lat: 16.5074, lng: 80.6369, worker: workerId },
      { dept: "Electricity",            title: "Streetlight not working for 2 weeks", addr: "Auto Nagar, Vijayawada", status: "Resolved", lat: 16.5167, lng: 80.6318 },
      { dept: "Sanitation",             title: "Garbage not collected for 3 days",    addr: "Patamata Colony",        status: "Pending",  lat: 16.4974, lng: 80.6451 },
    ];

    for (const c of complaints) {
      const cid = uuid();
      const ticketId = `CIV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*1000)}`;
      await conn.execute(
        `INSERT IGNORE INTO complaints (id,ticket_id,title,description,department,lat,lng,address,status,user_id,assigned_to)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [cid, ticketId, c.title, `Detailed report: ${c.title}`, c.dept, c.lat, c.lng, c.addr, c.status, citizenId, c.status === "Assigned" ? (c.worker ?? null) : null]
      );
    }
    console.log(`  ✅ ${complaints.length} complaints seeded`);
  }

  await conn.end();
  console.log("\n🎉 Seed complete!");
  console.log("\n📋 Demo Login Credentials:");
  console.log("  Admin:   admin@civic.ap.gov.in   / password123");
  console.log("  Officer: officer@civic.ap.gov.in / password123");
  console.log("  Worker:  worker@civic.ap.gov.in  / password123");
  console.log("  Citizen: citizen@civic.ap.gov.in / password123");
}

seed().catch(err => { console.error("Seed failed:", err); process.exit(1); });
