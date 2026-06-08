# CivicConnect — Smart Civic Complaint Management Platform

<div align="center">

# 🏛️ CivicConnect

### Bridging Citizens and Government Through Digital Governance

**Live Demo:** https://civic-connect-flame-omega.vercel.app/#news

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge\&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge\&logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=for-the-badge\&logo=node.js)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge\&logo=express)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge\&logo=mysql)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge\&logo=socket.io)

</div>

---

## 📖 Overview

CivicConnect is a modern full-stack civic complaint management platform designed to streamline communication between citizens, government officers, field workers, and administrators.

Citizens can report civic issues, track complaint progress, receive updates, and stay informed through real-time notifications and local news updates.

The platform improves transparency, accountability, and efficiency in public service management.

---

# 🚀 Live Demo

Frontend:

https://civic-connect-flame-omega.vercel.app/#news

GitHub Repository:

https://github.com/lovaraju4406/CivicConnect

---

# ✨ Features

## 👨‍💼 Citizen Features

* User Registration & Login
* Submit Civic Complaints
* Upload Images/Documents
* Complaint Tracking
* Real-Time Notifications
* News Feed
* Dashboard Analytics
* Complaint History
* Profile Management

---

## 👮 Officer Features

* View Assigned Complaints
* Update Complaint Status
* Assign Field Workers
* Complaint Prioritization
* Resolution Management
* Analytics Dashboard

---

## 👷 Worker Features

* View Assigned Tasks
* Update Work Progress
* Upload Proof Images
* Mark Tasks Completed
* Real-Time Updates

---

## 🛡️ Admin Features

* User Management
* Officer Management
* Complaint Monitoring
* Platform Analytics
* System Notifications
* Dashboard Overview

---

# 🔔 Real-Time Features

* Socket.IO Integration
* Live Notifications
* Complaint Status Updates
* Assignment Alerts
* Resolution Notifications

---

# 🛠 Tech Stack

## Frontend

* React.js
* TypeScript
* Redux Toolkit
* React Router
* Axios
* Vite
* CSS3

## Backend

* Node.js
* Express.js
* TypeScript
* JWT Authentication
* Socket.IO
* Multer

## Database

* MySQL

## Security

* JWT Authentication
* Password Hashing (bcrypt)
* Role-Based Access Control
* Express Rate Limiting
* Helmet Security

## Deployment

### Frontend

* Vercel

### Backend

* Railway

### Database

* Railway MySQL

---

# 📂 Project Structure

```bash
CivicConnect/
│
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── complaints/
│   │   │   └── dashboard/
│   │   ├── navigation/
│   │   ├── pages/
│   │   │   ├── citizen/
│   │   │   ├── officer/
│   │   │   ├── worker/
│   │   │   └── admin/
│   │   ├── services/
│   │   ├── store/
│   │   ├── App.tsx
│   │   └── main.tsx
│   │
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.ts
│   │   │   ├── migrate.ts
│   │   │   └── seed.ts
│   │   │
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── controllers/
│   │   └── index.ts
│   │
│   └── package.json
│
├── uploads/
├── README.md
└── .gitignore
```

---

# 🔑 User Roles

| Role    | Permissions                 |
| ------- | --------------------------- |
| Citizen | Submit and Track Complaints |
| Officer | Manage Complaints           |
| Worker  | Resolve Assigned Tasks      |
| Admin   | Full Platform Control       |

---

# 📊 Core Modules

### Authentication Module

* Login
* Registration
* JWT Authentication
* Role Management

### Complaint Management

* Complaint Creation
* Complaint Tracking
* Status Updates
* File Uploads

### Notification System

* Real-Time Notifications
* Complaint Alerts
* Assignment Updates

### Analytics Dashboard

* Complaint Statistics
* Resolution Metrics
* User Activity

---

# ⚙️ Installation

## Clone Repository

```bash
git clone https://github.com/lovaraju4406/CivicConnect.git
cd CivicConnect
```

---

## Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

Runs on:

```bash
http://localhost:5173
```

---

## Backend Setup

```bash
cd backend

npm install

npm run dev
```

Runs on:

```bash
http://localhost:3001
```

---

# 🔐 Environment Variables

## Backend (.env)

```env
PORT=3001

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=smart_civic_db

JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d

CLIENT_URL=http://localhost:5173

UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=5
```

---

# 🗄 Database Setup

Create Database:

```sql
CREATE DATABASE smart_civic_db;
```

Import Database:

```bash
mysql -u root -p smart_civic_db < smart_civic_db.sql
```

---

# 🔌 API Endpoints

## Authentication

```http
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

## Complaints

```http
GET    /api/complaints
POST   /api/complaints
PUT    /api/complaints/:id/status
DELETE /api/complaints/:id
```

## Users

```http
GET /api/users
GET /api/users/:id
```

## Notifications

```http
GET /api/notifications
```

## Analytics

```http
GET /api/analytics/summary
```

---

# 📈 Future Enhancements

* AI-Based Complaint Categorization
* GIS Location Tracking
* Mobile Application
* Email Notifications
* SMS Alerts
* AI Chat Assistant
* Government API Integration

---

# 👨‍💻 Author

### Lovaraju Dungala

GitHub:
https://github.com/lovaraju4406

LinkedIn:
https://www.linkedin.com/in/lovaraju-dungala-367591314/

---

# ⭐ Support

If you found this project useful, please consider giving it a ⭐ on GitHub.

---



</div>
