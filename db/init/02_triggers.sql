-- ============================================================
-- PulseTriage — DBMS Flagship Project (PostgreSQL 16+)
-- File: db/init/02_triggers.sql
-- Description: Core PL/pgSQL Triggers, Dynamic PK Audit Logger,
--              Automated Triage Escalation, Single Source of Truth Bed Sync.
-- ============================================================

-- ============================================================
-- 1. AUTOMATED TRIAGE SCORING & REAL-TIME NOTIFY TRIGGER
-- Module 3: Active Databases and Triggers
-- ============================================================

CREATE OR REPLACE FUNCTION fn_compute_triage_score()
RETURNS TRIGGER AS $$
DECLARE
    v_score NUMERIC(5,2) := 0;
    v_level triage_level_enum;
BEGIN
    -- 1. SpO2 component (weight: 30%) — lower is more critical
    IF NEW.spo2 IS NOT NULL THEN
        v_score := v_score + CASE
            WHEN NEW.spo2 < 85  THEN 30
            WHEN NEW.spo2 < 90  THEN 24
            WHEN NEW.spo2 < 94  THEN 15
            WHEN NEW.spo2 < 97  THEN 6
            ELSE 0
        END;
    END IF;

    -- 2. Heart rate component (weight: 20%) — extremes indicate shock/arrhythmia
    IF NEW.heart_rate IS NOT NULL THEN
        v_score := v_score + CASE
            WHEN NEW.heart_rate < 40 OR NEW.heart_rate > 150 THEN 20
            WHEN NEW.heart_rate < 50 OR NEW.heart_rate > 130 THEN 14
            WHEN NEW.heart_rate < 60 OR NEW.heart_rate > 110 THEN 8
            ELSE 0
        END;
    END IF;

    -- 3. Systolic BP component (weight: 20%) — hypotension / hypertensive crisis
    IF NEW.systolic_bp IS NOT NULL THEN
        v_score := v_score + CASE
            WHEN NEW.systolic_bp < 70 OR NEW.systolic_bp > 220 THEN 20
            WHEN NEW.systolic_bp < 90 OR NEW.systolic_bp > 180 THEN 14
            WHEN NEW.systolic_bp < 100 OR NEW.systolic_bp > 160 THEN 8
            ELSE 0
        END;
    END IF;

    -- 4. Glasgow Coma Scale (weight: 20%) — neurological consciousness
    IF NEW.gcs_score IS NOT NULL THEN
        v_score := v_score + CASE
            WHEN NEW.gcs_score <= 8  THEN 20
            WHEN NEW.gcs_score <= 12 THEN 14
            WHEN NEW.gcs_score <= 14 THEN 6
            ELSE 0
        END;
    END IF;

    -- 5. Body Temperature component (weight: 10%) — hypothermia / hyperpyrexia
    IF NEW.temperature_c IS NOT NULL THEN
        v_score := v_score + CASE
            WHEN NEW.temperature_c < 35.0 OR NEW.temperature_c > 40.0 THEN 10
            WHEN NEW.temperature_c < 36.0 OR NEW.temperature_c > 39.0 THEN 6
            ELSE 0
        END;
    END IF;

    -- Map total weighted score (0–100) to Emergency Severity Index level
    v_level := CASE
        WHEN v_score >= 70 THEN 'RESUSCITATION'::triage_level_enum
        WHEN v_score >= 50 THEN 'EMERGENT'::triage_level_enum
        WHEN v_score >= 30 THEN 'URGENT'::triage_level_enum
        WHEN v_score >= 15 THEN 'LESS_URGENT'::triage_level_enum
        ELSE 'NON_URGENT'::triage_level_enum
    END;

    NEW.computed_triage_score := v_score;
    NEW.auto_triage_level := v_level;

    -- Auto-escalate parent admission if critical condition detected
    IF v_level IN ('RESUSCITATION', 'EMERGENT') THEN
        UPDATE admissions
        SET triage_level = v_level
        WHERE admission_id = NEW.admission_id
          AND status = 'ACTIVE';

        -- Emit real-time notification via PostgreSQL NOTIFY
        PERFORM pg_notify('critical_alert',
            json_build_object(
                'admission_id', NEW.admission_id,
                'triage_level', v_level::text,
                'score', v_score,
                'spo2', NEW.spo2,
                'heart_rate', NEW.heart_rate,
                'recorded_at', NEW.recorded_at
            )::text
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_triage_score ON patient_vitals;
CREATE TRIGGER trg_auto_triage_score
    BEFORE INSERT OR UPDATE ON patient_vitals
    FOR EACH ROW
    EXECUTE FUNCTION fn_compute_triage_score();

-- ============================================================
-- 2. BED SYNCHRONIZATION ON ADMISSION (FIX #2: Single Source of Truth)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_sync_bed_on_admission_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Case 1: New active admission with assigned bed
    IF TG_OP = 'INSERT' THEN
        IF NEW.assigned_bed_id IS NOT NULL AND NEW.status = 'ACTIVE' THEN
            UPDATE beds
            SET status = 'OCCUPIED',
                current_patient_id = NEW.patient_id
            WHERE bed_id = NEW.assigned_bed_id;
        END IF;
        RETURN NEW;
    END IF;

    -- Case 2: Update on existing admission
    IF TG_OP = 'UPDATE' THEN
        -- 2a: Patient discharged/transferred/deceased → vacate bed
        IF OLD.status = 'ACTIVE'
           AND NEW.status IN ('DISCHARGED', 'TRANSFERRED', 'DECEASED')
           AND OLD.assigned_bed_id IS NOT NULL THEN
            UPDATE beds
            SET status = 'VACANT',
                current_patient_id = NULL,
                last_sanitized_at = NULL
            WHERE bed_id = OLD.assigned_bed_id;
        END IF;

        -- 2b: Bed reassignment (transfer to another bed)
        IF OLD.assigned_bed_id IS DISTINCT FROM NEW.assigned_bed_id THEN
            -- Vacate previous bed
            IF OLD.assigned_bed_id IS NOT NULL THEN
                UPDATE beds
                SET status = 'VACANT',
                    current_patient_id = NULL
                WHERE bed_id = OLD.assigned_bed_id;
            END IF;
            -- Occupy newly assigned bed
            IF NEW.assigned_bed_id IS NOT NULL AND NEW.status = 'ACTIVE' THEN
                UPDATE beds
                SET status = 'OCCUPIED',
                    current_patient_id = NEW.patient_id
                WHERE bed_id = NEW.assigned_bed_id;
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_bed_on_admission_change ON admissions;
CREATE TRIGGER trg_sync_bed_on_admission_change
    AFTER INSERT OR UPDATE ON admissions
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_bed_on_admission_change();

-- ============================================================
-- 3. WARD OCCUPANCY SYNC TRIGGER (Cascaded from Beds)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_sync_ward_occupancy()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status <> 'OCCUPIED' AND NEW.status = 'OCCUPIED' THEN
            UPDATE wards
            SET occupied_beds = LEAST(occupied_beds + 1, total_beds)
            WHERE ward_id = NEW.ward_id;
        ELSIF OLD.status = 'OCCUPIED' AND NEW.status <> 'OCCUPIED' THEN
            UPDATE wards
            SET occupied_beds = GREATEST(occupied_beds - 1, 0)
            WHERE ward_id = NEW.ward_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_ward_occupancy ON beds;
CREATE TRIGGER trg_sync_ward_occupancy
    AFTER UPDATE ON beds
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_ward_occupancy();

-- ============================================================
-- 4. APPLICATION-LAYER AUDIT TRAIL TRIGGER (FIX #1 & FIX #3)
-- Dynamic Primary Key extraction across any table
-- ============================================================

CREATE OR REPLACE FUNCTION fn_capture_audit_trail()
RETURNS TRIGGER AS $$
DECLARE
    v_record_id UUID;
    v_pk_column TEXT;
    v_row_data JSONB;
BEGIN
    -- Dynamically query catalog to identify the table's primary key column name
    SELECT a.attname INTO v_pk_column
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = TG_RELID AND i.indisprimary
    LIMIT 1;

    -- Extract row representation to JSONB
    IF TG_OP = 'DELETE' THEN
        v_row_data := to_jsonb(OLD);
    ELSE
        v_row_data := to_jsonb(NEW);
    END IF;

    -- Safely parse UUID from the designated PK column
    IF v_pk_column IS NOT NULL AND v_row_data ? v_pk_column THEN
        v_record_id := (v_row_data ->> v_pk_column)::UUID;
    ELSE
        v_record_id := gen_random_uuid();
    END IF;

    -- Record the audit entry
    IF TG_OP = 'INSERT' THEN
        INSERT INTO patient_audit_trail
            (table_name, record_id, operation, old_values, new_values, changed_by)
        VALUES (TG_TABLE_NAME, v_record_id, 'INSERT', NULL, to_jsonb(NEW), CURRENT_USER);

    ELSIF TG_OP = 'UPDATE' THEN
        IF to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
            INSERT INTO patient_audit_trail
                (table_name, record_id, operation, old_values, new_values, changed_by)
            VALUES (TG_TABLE_NAME, v_record_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), CURRENT_USER);
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO patient_audit_trail
            (table_name, record_id, operation, old_values, new_values, changed_by)
        VALUES (TG_TABLE_NAME, v_record_id, 'DELETE', to_jsonb(OLD), NULL, CURRENT_USER);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Attach dynamic audit trigger to all clinical lifecycle tables
DROP TRIGGER IF EXISTS trg_audit_admissions ON admissions;
CREATE TRIGGER trg_audit_admissions
    AFTER INSERT OR UPDATE OR DELETE ON admissions
    FOR EACH ROW EXECUTE FUNCTION fn_capture_audit_trail();

DROP TRIGGER IF EXISTS trg_audit_vitals ON patient_vitals;
CREATE TRIGGER trg_audit_vitals
    AFTER INSERT OR UPDATE OR DELETE ON patient_vitals
    FOR EACH ROW EXECUTE FUNCTION fn_capture_audit_trail();

DROP TRIGGER IF EXISTS trg_audit_beds ON beds;
CREATE TRIGGER trg_audit_beds
    AFTER INSERT OR UPDATE OR DELETE ON beds
    FOR EACH ROW EXECUTE FUNCTION fn_capture_audit_trail();

DROP TRIGGER IF EXISTS trg_audit_prescriptions ON prescriptions;
CREATE TRIGGER trg_audit_prescriptions
    AFTER INSERT OR UPDATE OR DELETE ON prescriptions
    FOR EACH ROW EXECUTE FUNCTION fn_capture_audit_trail();
