-- ============================================================
-- PulseTriage — DBMS Flagship Project (PostgreSQL 16+)
-- File: db/init/01_schema_and_rbac.sql
-- Description: Core DDL, 6 ENUMs, 12 Normalized Tables (3NF/BCNF),
--              Strategic Indexes, Roles, GRANTs, and RLS Policies.
-- ============================================================

-- ============================================================
-- 1. CUSTOM ENUM TYPES
-- ============================================================

DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('admin', 'doctor', 'nurse', 'receptionist');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE triage_level_enum AS ENUM (
        'RESUSCITATION',   -- Level 1 (Red)
        'EMERGENT',        -- Level 2 (Orange)
        'URGENT',          -- Level 3 (Amber)
        'LESS_URGENT',     -- Level 4 (Green)
        'NON_URGENT'       -- Level 5 (Blue)
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE bed_status_enum AS ENUM (
        'VACANT', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ward_type_enum AS ENUM (
        'ICU', 'GENERAL', 'EMERGENCY', 'PEDIATRIC', 'SURGICAL', 'MATERNITY'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE admission_status_enum AS ENUM (
        'ACTIVE', 'DISCHARGED', 'TRANSFERRED', 'DECEASED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE gender_enum AS ENUM ('M', 'F', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 2. CORE TABLES (3NF / BCNF Compliant)
-- ============================================================

-- 2.1 Users (Supertype for authentication and RBAC)
CREATE TABLE IF NOT EXISTS users (
    user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(150) NOT NULL,
    role          user_role_enum NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 Departments
CREATE TABLE IF NOT EXISTS departments (
    department_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    floor_number    INTEGER NOT NULL CHECK (floor_number >= 0),
    head_doctor_id  UUID REFERENCES users(user_id) ON DELETE SET NULL
);

-- 2.3 Doctors (ISA subtype of Users)
CREATE TABLE IF NOT EXISTS doctors (
    doctor_id       UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    specialization  VARCHAR(100) NOT NULL,
    license_number  VARCHAR(50) NOT NULL UNIQUE,
    department_id   UUID NOT NULL REFERENCES departments(department_id)
);

-- 2.4 Wards
CREATE TABLE IF NOT EXISTS wards (
    ward_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_name     VARCHAR(100) NOT NULL,
    ward_type     ward_type_enum NOT NULL,
    department_id UUID NOT NULL REFERENCES departments(department_id),
    total_beds    INTEGER NOT NULL CHECK (total_beds > 0),
    occupied_beds INTEGER NOT NULL DEFAULT 0
                  CHECK (occupied_beds >= 0 AND occupied_beds <= total_beds)
);

-- 2.5 Nurses (ISA subtype of Users)
CREATE TABLE IF NOT EXISTS nurses (
    nurse_id         UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    qualification    VARCHAR(100) NOT NULL,
    current_ward_id  UUID REFERENCES wards(ward_id) ON DELETE SET NULL
);

-- 2.6 Receptionists (ISA subtype of Users)
CREATE TABLE IF NOT EXISTS receptionists (
    receptionist_id  UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    desk_number      VARCHAR(20) NOT NULL
);

-- 2.7 Patients (Master Patient Index)
CREATE TABLE IF NOT EXISTS patients (
    patient_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name         VARCHAR(150) NOT NULL,
    date_of_birth     DATE NOT NULL CHECK (date_of_birth <= CURRENT_DATE),
    gender            gender_enum NOT NULL,
    blood_group       VARCHAR(5) CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
    phone             VARCHAR(15) NOT NULL UNIQUE,
    emergency_contact VARCHAR(15),
    registered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.8 Beds (Physical assets; status & current_patient_id are derived via triggers)
CREATE TABLE IF NOT EXISTS beds (
    bed_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bed_number         VARCHAR(20) NOT NULL,
    ward_id            UUID NOT NULL REFERENCES wards(ward_id) ON DELETE CASCADE,
    status             bed_status_enum NOT NULL DEFAULT 'VACANT',
    current_patient_id UUID REFERENCES patients(patient_id) ON DELETE SET NULL,
    last_sanitized_at  TIMESTAMPTZ,
    UNIQUE (ward_id, bed_number)
);

-- 2.9 Admissions (Single Source of Truth for Bed Allocation & Triage Lifecycle)
CREATE TABLE IF NOT EXISTS admissions (
    admission_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id           UUID NOT NULL REFERENCES patients(patient_id) ON DELETE RESTRICT,
    admitting_doctor_id  UUID NOT NULL REFERENCES doctors(doctor_id) ON DELETE RESTRICT,
    assigned_bed_id      UUID REFERENCES beds(bed_id) ON DELETE SET NULL,
    triage_level         triage_level_enum NOT NULL DEFAULT 'LESS_URGENT',
    chief_complaint      TEXT NOT NULL,
    admitted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    discharged_at        TIMESTAMPTZ,
    status               admission_status_enum NOT NULL DEFAULT 'ACTIVE',
    CHECK (discharged_at IS NULL OR discharged_at > admitted_at)
);

-- 2.10 Patient Vitals (High-frequency physiological telemetry timeseries)
CREATE TABLE IF NOT EXISTS patient_vitals (
    vitals_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id          UUID NOT NULL REFERENCES admissions(admission_id) ON DELETE CASCADE,
    heart_rate            INTEGER CHECK (heart_rate BETWEEN 20 AND 300),
    systolic_bp           INTEGER CHECK (systolic_bp > 0 AND systolic_bp < 400),
    diastolic_bp          INTEGER CHECK (diastolic_bp > 0 AND diastolic_bp < 300),
    spo2                  NUMERIC(5,2) CHECK (spo2 BETWEEN 0 AND 100),
    temperature_c         NUMERIC(4,1) CHECK (temperature_c BETWEEN 25.0 AND 45.0),
    respiratory_rate      INTEGER CHECK (respiratory_rate BETWEEN 4 AND 80),
    gcs_score             INTEGER CHECK (gcs_score BETWEEN 3 AND 15),
    computed_triage_score NUMERIC(5,2),
    auto_triage_level     triage_level_enum,
    recorded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.11 Prescriptions (Medications and Orders)
CREATE TABLE IF NOT EXISTS prescriptions (
    prescription_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admission_id          UUID NOT NULL REFERENCES admissions(admission_id) ON DELETE CASCADE,
    prescribing_doctor_id UUID NOT NULL REFERENCES doctors(doctor_id) ON DELETE RESTRICT,
    medication_name       VARCHAR(200) NOT NULL,
    dosage                VARCHAR(100) NOT NULL,
    frequency             VARCHAR(100) NOT NULL,
    prescribed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.12 Patient Audit Trail (Application-Layer Temporal Table Pattern)
CREATE TABLE IF NOT EXISTS patient_audit_trail (
    audit_id    BIGSERIAL PRIMARY KEY,
    table_name  VARCHAR(63) NOT NULL,
    record_id   UUID NOT NULL,
    operation   VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
    old_values  JSONB,
    new_values  JSONB,
    changed_by  VARCHAR(150) NOT NULL DEFAULT CURRENT_USER,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. STRATEGIC INDEXES (Module 6 — Query Optimization)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_vitals_admission_time
    ON patient_vitals (admission_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_admissions_patient_status
    ON admissions (patient_id, status);

CREATE INDEX IF NOT EXISTS idx_admissions_triage_active
    ON admissions (triage_level, status) WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_beds_ward_status
    ON beds (ward_id, status);

CREATE INDEX IF NOT EXISTS idx_audit_table_record
    ON patient_audit_trail (table_name, record_id, changed_at DESC);

-- Partial unique index ensuring at most one ACTIVE admission per bed
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_bed_assignment
    ON admissions (assigned_bed_id)
    WHERE status = 'ACTIVE' AND assigned_bed_id IS NOT NULL;

-- ============================================================
-- 4. ROLE-BASED ACCESS CONTROL & RLS (Module 7 — Security)
-- ============================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'doctor_role') THEN
        CREATE ROLE doctor_role NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nurse_role') THEN
        CREATE ROLE nurse_role NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'receptionist_role') THEN
        CREATE ROLE receptionist_role NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_role') THEN
        CREATE ROLE admin_role NOLOGIN;
    END IF;
END $$;

-- If pt_admin exists, grant app roles to it
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pt_admin') THEN
        GRANT doctor_role TO pt_admin;
        GRANT nurse_role TO pt_admin;
        GRANT receptionist_role TO pt_admin;
        GRANT admin_role TO pt_admin;
    END IF;
END $$;

-- Doctor Permissions: Full read on clinical data, can prescribe and update vitals
GRANT SELECT ON ALL TABLES IN SCHEMA public TO doctor_role;
GRANT INSERT, UPDATE ON admissions, prescriptions, patient_vitals TO doctor_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO doctor_role;

-- Nurse Permissions: Read patients/beds/wards, insert vitals, cannot prescribe
GRANT SELECT ON patients, admissions, beds, wards, patient_vitals TO nurse_role;
GRANT INSERT ON patient_vitals TO nurse_role;
GRANT UPDATE (assigned_bed_id, status) ON admissions TO nurse_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nurse_role;

-- Receptionist Permissions: Register patients and create admissions
GRANT SELECT ON patients, admissions, beds, wards, doctors TO receptionist_role;
GRANT INSERT ON patients, admissions TO receptionist_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO receptionist_role;

-- Admin Permissions: Full access
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin_role;

-- Row-Level Security on audit trail
ALTER TABLE patient_audit_trail ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_read_policy ON patient_audit_trail;
CREATE POLICY audit_read_policy ON patient_audit_trail
    FOR SELECT
    USING (
        CURRENT_USER IN ('pt_admin', 'postgres')
        OR pg_has_role(CURRENT_USER, 'doctor_role', 'MEMBER')
        OR pg_has_role(CURRENT_USER, 'admin_role', 'MEMBER')
    );

-- Row-Level Security on prescriptions
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prescription_full_access ON prescriptions;
CREATE POLICY prescription_full_access ON prescriptions
    FOR ALL
    USING (
        CURRENT_USER IN ('pt_admin', 'postgres')
        OR pg_has_role(CURRENT_USER, 'doctor_role', 'MEMBER')
        OR pg_has_role(CURRENT_USER, 'admin_role', 'MEMBER')
    );

DROP POLICY IF EXISTS prescription_read_only ON prescriptions;
CREATE POLICY prescription_read_only ON prescriptions
    FOR SELECT
    USING (
        pg_has_role(CURRENT_USER, 'nurse_role', 'MEMBER')
        OR pg_has_role(CURRENT_USER, 'receptionist_role', 'MEMBER')
    );
