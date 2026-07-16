# PROJECT SPECIFICATION: EDUMANAGER (TEACHER EVALUATION & KPI SYSTEM)

## 1. PROJECT OVERVIEW
You are an Expert Full-Stack Developer. Your task is to build "EduManager" - a private school teacher management and evaluation system. 
The system focuses on discipline (Penalties), rewards (Kudos), and automated KPI calculation.

**Core Tech Stack (Suggested):** Next.js (React), Firebase (Firestore & Auth), node-cron (for background jobs), Nodemailer (for SMTP Email).

---

## 2. ROLE-BASED ACCESS CONTROL (RBAC)
Strictly implement 4 roles. UI and API responses MUST be filtered based on the requester's role.
- `ADMIN`: Highest technical privilege. Has hidden backdoor features.
- `BGH` (Principal): Global view. Can evaluate anyone, view all reports, approve/reject all appeals.
- `TTCM` (Head of Department): Department view. Can only evaluate and view teachers within their specific department.
- `TEACHER`: Personal view. Can only view own evaluations and submit appeals.

---

## 3. DATABASE SCHEMA (Firebase Firestore NoSQL format)

**Collection `users`**
- `uid` (Document ID)
- `email`: String
- `fullName`: String
- `role`: String // ENUM: ADMIN, BGH, TTCM, TEACHER
- `departmentId`: String? // Nullable for ADMIN/BGH

**Collection `departments`**
- `id` (Document ID)
- `name`: String
- `managerId`: String // User ID (Role: TTCM)

**Collection `rules`**
- `id` (Document ID)
- `name`: String
- `type`: String // ENUM: PENALTY, KUDOS
- `score`: Number // Negative for penalty, positive for kudos
- `description`: String?

**Collection `evaluations`**
- `id` (Document ID)
- `teacherId`: String // User ID
- `evaluatorId`: String // User ID (BGH/TTCM)
- `ruleId`: String // Rule ID
- `evidenceUrl`: String?
- `status`: String // ENUM: PENDING, APPEALED, RESOLVED, REJECTED, AUTO_REJECTED
- `createdAt`: Timestamp
- `deadlineAt`: Timestamp // Must automatically be set to createdAt + 48 hours
- `isReminderSent`: Boolean (default: false)
- `isDeleted`: Boolean (default: false) // ADMIN HIDDEN FEATURE (Soft Delete)

**Collection `appeals`**
- `id` (Document ID)
- `evaluationId`: String // Evaluation ID
- `reason`: String
- `evidenceUrl`: String?
- `createdAt`: Timestamp

**Collection `auditLogs`**
- `id` (Document ID)
- `adminId`: String // User ID (Admin who performed action)
- `action`: String // e.g., "FORCE_RESOLVE", "SOFT_DELETE"
- `targetEvalId`: String?
- `timestamp`: Timestamp