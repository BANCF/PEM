# PROJECT SPECIFICATION: EDUMANAGER (TEACHER EVALUATION & KPI SYSTEM)

## 1. PROJECT OVERVIEW
You are an Expert Full-Stack Developer. Your task is to build "EduManager" - a private school teacher management and evaluation system. 
The system focuses on discipline (Penalties), rewards (Kudos), and automated KPI calculation.

**Core Tech Stack (Suggested):** Next.js (React), Node.js/NestJS, PostgreSQL (Prisma ORM), node-cron (for background jobs), Nodemailer (for SMTP Email).

---

## 2. ROLE-BASED ACCESS CONTROL (RBAC)
Strictly implement 4 roles. UI and API responses MUST be filtered based on the requester's role.
- `ADMIN`: Highest technical privilege. Has hidden backdoor features.
- `BGH` (Principal): Global view. Can evaluate anyone, view all reports, approve/reject all appeals.
- `TTCM` (Head of Department): Department view. Can only evaluate and view teachers within their specific department.
- `TEACHER`: Personal view. Can only view own evaluations and submit appeals.

---

## 3. DATABASE SCHEMA (PostgreSQL / Prisma format)

```prisma
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String
  fullName      String
  role          Role     // ENUM: ADMIN, BGH, TTCM, TEACHER
  departmentId  String?  // Nullable for ADMIN/BGH
  evaluations   Evaluation[] @relation("TeacherEvals")
}

model Department {
  id            String   @id @default(uuid())
  name          String
  managerId     String   // FK to User (Role: TTCM)
}

model Rule {
  id            String   @id @default(uuid())
  name          String
  type          RuleType // ENUM: PENALTY, KUDOS
  score         Int      // Negative for penalty, positive for kudos
  description   String?
}

model Evaluation {
  id                String   @id @default(uuid())
  teacherId         String   // FK to User
  evaluatorId       String   // FK to User (BGH/TTCM)
  ruleId            String   // FK to Rule
  evidenceUrl       String?
  status            EvalStatus // ENUM: PENDING, APPEALED, RESOLVED, REJECTED, AUTO_REJECTED
  
  // CRON JOB & DEADLINE TRACKING
  createdAt         DateTime @default(now())
  deadlineAt        DateTime // Must automatically be set to createdAt + 48 hours
  isReminderSent    Boolean  @default(false)
  
  // ADMIN HIDDEN FEATURE (Soft Delete)
  isDeleted         Boolean  @default(false) 
}

model Appeal {
  id            String   @id @default(uuid())
  evaluationId  String   @unique // FK to Evaluation
  reason        String
  evidenceUrl   String?
  createdAt     DateTime @default(now())
}

model AuditLog {
  id            String   @id @default(uuid())
  adminId       String   // FK to User (Admin who performed action)
  action        String   // e.g., "FORCE_RESOLVE", "SOFT_DELETE"
  targetEvalId  String?
  timestamp     DateTime @default(now())
}