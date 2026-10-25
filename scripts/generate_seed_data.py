#!/usr/bin/env python3
"""
PulseTriage — Synthetic Clinical Data Generator (Phase 1)
Generates realistic seed SQL statements for:
- Departments, Wards, Beds
- Users & Staff (Doctors, Nurses, Receptionists, Admins)
- Patients (realistic names, DOBs, blood groups, phone numbers)
- Admissions across all 5 ESI levels
- 50,000+ physiological vitals telemetry logs for Module 6 EXPLAIN ANALYZE benchmarks
- Prescriptions & Audit logs
"""

import sys
import uuid
import random
from datetime import datetime, timedelta, timezone

def escape_sql(val):
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, (int, float)):
        return str(val)
    # String escaping
    return "'" + str(val).replace("'", "''") + "'"

def generate_seed_sql(output_path, num_patients=200, num_vitals=50000):
    print(f"Generating PulseTriage clinical seed data...")
    print(f"Target: {num_patients} patients, {num_vitals} vitals records -> {output_path}")

    random.seed(42)
    lines = []
    lines.append("-- ============================================================")
    lines.append("-- PulseTriage — Synthetic Clinical Seed Data (Module 1-7)")
    lines.append(f"-- Generated At: {datetime.now(timezone.utc).isoformat()}")
    lines.append("-- ============================================================\n")
    lines.append("BEGIN;\n")

    # 1. DEPARTMENTS
    dept_defs = [
        ("Emergency & Trauma Center", 0),
        ("Intensive Care Unit (ICU)", 1),
        ("Department of Cardiology", 2),
        ("Internal & General Medicine", 3),
        ("Department of Surgery", 4)
    ]
    departments = []
    lines.append("-- 1. DEPARTMENTS")
    for name, floor in dept_defs:
        d_id = str(uuid.uuid4())
        departments.append({"id": d_id, "name": name, "floor": floor})
        lines.append(f"INSERT INTO departments (department_id, name, floor_number) VALUES ({escape_sql(d_id)}, {escape_sql(name)}, {floor});")
    lines.append("")

    # 2. WARDS
    ward_defs = [
        ("Trauma Resuscitation Bay", "EMERGENCY", departments[0]["id"], 10),
        ("Cardiac Intensive Care Unit", "ICU", departments[1]["id"], 12),
        ("Medical ICU (MICU)", "ICU", departments[1]["id"], 8),
        ("Acute Medical Care Ward", "GENERAL", departments[3]["id"], 15),
        ("Surgical Recovery Ward", "SURGICAL", departments[4]["id"], 15)
    ]
    wards = []
    lines.append("-- 2. WARDS")
    for w_name, w_type, d_id, total_beds in ward_defs:
        w_id = str(uuid.uuid4())
        wards.append({"id": w_id, "name": w_name, "type": w_type, "dept_id": d_id, "total_beds": total_beds})
        lines.append(f"INSERT INTO wards (ward_id, ward_name, ward_type, department_id, total_beds, occupied_beds) "
                     f"VALUES ({escape_sql(w_id)}, {escape_sql(w_name)}, {escape_sql(w_type)}, {escape_sql(d_id)}, {total_beds}, 0);")
    lines.append("")

    # 3. BEDS (50+ beds distributed across wards)
    beds = []
    lines.append("-- 3. BEDS")
    for ward in wards:
        prefix = ward["name"][:3].upper().replace(" ", "")
        for b_idx in range(1, ward["total_beds"] + 1):
            bed_id = str(uuid.uuid4())
            b_num = f"{prefix}-{b_idx:02d}"
            beds.append({"id": bed_id, "number": b_num, "ward_id": ward["id"], "status": "VACANT"})
            lines.append(f"INSERT INTO beds (bed_id, bed_number, ward_id, status) "
                         f"VALUES ({escape_sql(bed_id)}, {escape_sql(b_num)}, {escape_sql(ward['id'])}, 'VACANT');")
    lines.append("")

    # 4. USERS & STAFF
    first_names = ["Arjun", "Ananya", "Rohan", "Priya", "Vikram", "Sneha", "Karthik", "Deepa", "Rahul", "Pooja", "Amit", "Meera", "Aditya", "Neha", "Sanjay"]
    last_names = ["Sharma", "Verma", "Patel", "Reddy", "Nair", "Iyer", "Rao", "Gupta", "Deshmukh", "Chopra", "Menon", "Bose", "Kulkarni"]

    lines.append("-- 4. USERS & STAFF")
    # Admin User
    admin_id = str(uuid.uuid4())
    lines.append(f"INSERT INTO users (user_id, email, password_hash, full_name, role) "
                 f"VALUES ({escape_sql(admin_id)}, 'admin@pulsetriage.hospital', '$2b$10$PulseTriageAdminHashExample', 'Dr. System Administrator', 'admin');")

    # Doctors
    doctors = []
    specializations = ["Emergency Medicine", "Critical Care / Intensivist", "Cardiology", "Trauma Surgery", "Pulmonology"]
    for i in range(10):
        u_id = str(uuid.uuid4())
        name = f"Dr. {random.choice(first_names)} {random.choice(last_names)}"
        email = f"doctor_{i+1}@pulsetriage.hospital"
        lines.append(f"INSERT INTO users (user_id, email, password_hash, full_name, role) "
                     f"VALUES ({escape_sql(u_id)}, {escape_sql(email)}, '$2b$10$PulseTriageDoctorHashExample', {escape_sql(name)}, 'doctor');")
        spec = random.choice(specializations)
        lic = f"MCI-REG-{2020000 + i}"
        dept_id = random.choice(departments)["id"]
        doctors.append({"id": u_id, "name": name, "dept_id": dept_id})
        lines.append(f"INSERT INTO doctors (doctor_id, specialization, license_number, department_id) "
                     f"VALUES ({escape_sql(u_id)}, {escape_sql(spec)}, {escape_sql(lic)}, {escape_sql(dept_id)});")

    # Nurses
    nurses = []
    for i in range(15):
        u_id = str(uuid.uuid4())
        name = f"Nurse {random.choice(first_names)} {random.choice(last_names)}"
        email = f"nurse_{i+1}@pulsetriage.hospital"
        lines.append(f"INSERT INTO users (user_id, email, password_hash, full_name, role) "
                     f"VALUES ({escape_sql(u_id)}, {escape_sql(email)}, '$2b$10$PulseTriageNurseHashExample', {escape_sql(name)}, 'nurse');")
        qual = random.choice(["B.Sc Nursing (Critical Care)", "GNM (Emergency Trauma)", "M.Sc Nursing", "Certified Triage Specialist"])
        ward_id = random.choice(wards)["id"]
        nurses.append({"id": u_id, "name": name, "ward_id": ward_id})
        lines.append(f"INSERT INTO nurses (nurse_id, qualification, current_ward_id) "
                     f"VALUES ({escape_sql(u_id)}, {escape_sql(qual)}, {escape_sql(ward_id)});")

    # Receptionists
    for i in range(4):
        u_id = str(uuid.uuid4())
        name = f"{random.choice(first_names)} {random.choice(last_names)}"
        email = f"reception_{i+1}@pulsetriage.hospital"
        lines.append(f"INSERT INTO users (user_id, email, password_hash, full_name, role) "
                     f"VALUES ({escape_sql(u_id)}, {escape_sql(email)}, '$2b$10$PulseTriageStaffHashExample', {escape_sql(name)}, 'receptionist');")
        lines.append(f"INSERT INTO receptionists (receptionist_id, desk_number) "
                     f"VALUES ({escape_sql(u_id)}, 'DESK-0{i+1}');")
    lines.append("")

    # 5. PATIENTS
    patients = []
    lines.append("-- 5. PATIENTS")
    blood_groups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
    genders = ["M", "F", "OTHER"]

    for i in range(num_patients):
        p_id = str(uuid.uuid4())
        p_name = f"{random.choice(first_names)} {random.choice(last_names)}"
        # Age between 1 and 88
        age_days = random.randint(365, 365 * 88)
        dob = (datetime.now() - timedelta(days=age_days)).strftime("%Y-%m-%d")
        gender = random.choice(genders)
        bg = random.choice(blood_groups)
        phone = f"9{random.randint(100000000, 999999999)}"
        em_contact = f"9{random.randint(100000000, 999999999)}"
        reg_time = (datetime.now() - timedelta(days=random.randint(1, 30))).strftime("%Y-%m-%d %H:%M:%S")

        patients.append({"id": p_id, "name": p_name})
        lines.append(f"INSERT INTO patients (patient_id, full_name, date_of_birth, gender, blood_group, phone, emergency_contact, registered_at) "
                     f"VALUES ({escape_sql(p_id)}, {escape_sql(p_name)}, {escape_sql(dob)}, {escape_sql(gender)}, {escape_sql(bg)}, {escape_sql(phone)}, {escape_sql(em_contact)}, {escape_sql(reg_time)});")
    lines.append("")

    # 6. ADMISSIONS
    complaints = [
        "Acute crushing chest pain radiating to left jaw, diaphoresis",
        "Severe shortness of breath, bilateral wheezing, cyanosis",
        "High grade fever 103F with altered mental status and lethargy",
        "Polytrauma following high-speed motor vehicle collision",
        "Uncontrolled diabetic ketoacidosis, vomiting, tachycardia",
        "Acute abdominal pain in right lower quadrant with guarding",
        "Suspected ischemic stroke with left sided facial droop and hemiparesis",
        "Laceration on right forearm with controlled bleeding",
        "Severe migraine with photophobia and nausea",
        "Blunt thoracic trauma, pleuritic chest pain"
    ]
    triage_levels = ["RESUSCITATION", "EMERGENT", "URGENT", "LESS_URGENT", "NON_URGENT"]
    triage_weights = [0.10, 0.25, 0.35, 0.20, 0.10]

    lines.append("-- 6. ADMISSIONS")
    admissions = []
    active_beds_used = set()

    # Assign ~40 active admissions to beds
    num_admissions = min(len(patients), 120)
    for i in range(num_admissions):
        adm_id = str(uuid.uuid4())
        patient = patients[i]
        doctor = random.choice(doctors)
        t_level = random.choices(triage_levels, weights=triage_weights)[0]
        complaint = random.choice(complaints)

        # 40% active (with beds), 60% discharged
        is_active = (i < 35) and (len(active_beds_used) < len(beds))
        adm_dt = datetime.now() - timedelta(hours=random.randint(12, 96))
        adm_time = adm_dt.strftime("%Y-%m-%d %H:%M:%S")

        if is_active:
            status = "ACTIVE"
            discharged_at = None
            # Find an unused bed
            avail_beds = [b for b in beds if b["id"] not in active_beds_used]
            assigned_bed = random.choice(avail_beds)["id"] if avail_beds else None
            if assigned_bed:
                active_beds_used.add(assigned_bed)
        else:
            status = "DISCHARGED"
            assigned_bed = None
            discharged_dt = adm_dt + timedelta(hours=random.randint(1, 10))
            discharged_at = discharged_dt.strftime("%Y-%m-%d %H:%M:%S")

        admissions.append({"id": adm_id, "patient_id": patient["id"], "triage_level": t_level, "status": status})
        lines.append(f"INSERT INTO admissions (admission_id, patient_id, admitting_doctor_id, assigned_bed_id, triage_level, chief_complaint, admitted_at, discharged_at, status) "
                     f"VALUES ({escape_sql(adm_id)}, {escape_sql(patient['id'])}, {escape_sql(doctor['id'])}, {escape_sql(assigned_bed)}, {escape_sql(t_level)}, {escape_sql(complaint)}, {escape_sql(adm_time)}, {escape_sql(discharged_at)}, {escape_sql(status)});")
    lines.append("")

    # 7. PRESCRIPTIONS
    lines.append("-- 7. PRESCRIPTIONS")
    meds = [
        ("Aspirin 325mg PO STAT", "325 mg", "Once immediately"),
        ("Nitroglycerin 0.4mg SL", "0.4 mg", "Every 5 mins up to 3 doses"),
        ("Normal Saline 0.9% IV Infusion", "1000 mL", "Over 2 hours"),
        ("Morphine Sulfate IV", "4 mg", "Every 4 hours PRN severe pain"),
        ("Ceftriaxone IV", "1 g", "Every 12 hours"),
        ("Ondansetron IV", "4 mg", "Every 8 hours PRN nausea"),
        ("Salbutamol Nebulization", "2.5 mg", "Every 20 mins x 3 doses"),
        ("Atorvastatin PO", "80 mg", "At bedtime"),
        ("Enoxaparin Sodium SubQ", "60 mg", "Every 12 hours")
    ]
    for adm in admissions[:60]:
        doc = random.choice(doctors)
        med_sample = random.sample(meds, k=random.randint(1, 3))
        for m_name, dosage, freq in med_sample:
            presc_id = str(uuid.uuid4())
            lines.append(f"INSERT INTO prescriptions (prescription_id, admission_id, prescribing_doctor_id, medication_name, dosage, frequency) "
                         f"VALUES ({escape_sql(presc_id)}, {escape_sql(adm['id'])}, {escape_sql(doc['id'])}, {escape_sql(m_name)}, {escape_sql(dosage)}, {escape_sql(freq)});")
    lines.append("")

    # 8. PATIENT VITALS (Telemetry Timeseries for EXPLAIN ANALYZE)
    lines.append(f"-- 8. PATIENT VITALS ({num_vitals} rows for Module 6 B-Tree benchmark)")
    lines.append("-- Temporarily disable auto_triage trigger during bulk insert for high-speed ingestion")
    lines.append("ALTER TABLE patient_vitals DISABLE TRIGGER trg_auto_triage_score;")
    lines.append("ALTER TABLE patient_vitals DISABLE TRIGGER trg_audit_vitals;\n")

    vitals_per_batch = 1000
    total_written = 0
    now = datetime.now()

    # Pre-select one flagship admission that will have ~1000 records for the exact viva demo
    flagship_adm_id = admissions[0]["id"]
    print(f"Flagship Viva Demo Admission ID: {flagship_adm_id}")

    # Write flagship admission vitals (e.g. 1500 logs)
    flagship_logs = min(1500, num_vitals // 4)
    for i in range(flagship_logs):
        v_id = str(uuid.uuid4())
        rec_time = (now - timedelta(minutes=i * 2)).strftime("%Y-%m-%d %H:%M:%S")
        hr = random.randint(70, 145)
        sbp = random.randint(95, 175)
        dbp = random.randint(60, 105)
        spo2 = round(random.uniform(88.0, 99.5), 1)
        temp = round(random.uniform(36.2, 39.1), 1)
        rr = random.randint(14, 28)
        gcs = random.randint(10, 15)
        score = round(random.uniform(10.0, 75.0), 2)
        level = "RESUSCITATION" if score >= 70 else ("EMERGENT" if score >= 50 else ("URGENT" if score >= 30 else "LESS_URGENT"))

        lines.append(f"INSERT INTO patient_vitals (vitals_id, admission_id, heart_rate, systolic_bp, diastolic_bp, spo2, temperature_c, respiratory_rate, gcs_score, computed_triage_score, auto_triage_level, recorded_at) "
                     f"VALUES ({escape_sql(v_id)}, {escape_sql(flagship_adm_id)}, {hr}, {sbp}, {dbp}, {spo2}, {temp}, {rr}, {gcs}, {score}, {escape_sql(level)}, {escape_sql(rec_time)});")
        total_written += 1

    # Remaining vitals spread across other admissions
    remaining = num_vitals - total_written
    for i in range(remaining):
        v_id = str(uuid.uuid4())
        adm = random.choice(admissions)
        rec_time = (now - timedelta(minutes=random.randint(5, 60 * 24 * 7))).strftime("%Y-%m-%d %H:%M:%S")
        hr = random.randint(45, 160)
        sbp = random.randint(75, 190)
        dbp = random.randint(45, 115)
        spo2 = round(random.uniform(84.0, 99.8), 1)
        temp = round(random.uniform(35.5, 39.8), 1)
        rr = random.randint(10, 32)
        gcs = random.randint(7, 15)
        score = round(random.uniform(5.0, 85.0), 2)
        level = "RESUSCITATION" if score >= 70 else ("EMERGENT" if score >= 50 else ("URGENT" if score >= 30 else "LESS_URGENT"))

        lines.append(f"INSERT INTO patient_vitals (vitals_id, admission_id, heart_rate, systolic_bp, diastolic_bp, spo2, temperature_c, respiratory_rate, gcs_score, computed_triage_score, auto_triage_level, recorded_at) "
                     f"VALUES ({escape_sql(v_id)}, {escape_sql(adm['id'])}, {hr}, {sbp}, {dbp}, {spo2}, {temp}, {rr}, {gcs}, {score}, {escape_sql(level)}, {escape_sql(rec_time)});")
        total_written += 1

    lines.append("\nALTER TABLE patient_vitals ENABLE TRIGGER trg_auto_triage_score;")
    lines.append("ALTER TABLE patient_vitals ENABLE TRIGGER trg_audit_vitals;\n")

    # Finalize
    lines.append("COMMIT;\n")
    lines.append("-- Sync initial bed and ward statuses")
    lines.append("UPDATE beds SET status = 'OCCUPIED' WHERE current_patient_id IS NOT NULL;\n")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"Successfully generated {len(lines)} lines of SQL in {output_path} with {total_written} vitals records.")

if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else "db/init/03_seed_data.sql"
    count = int(sys.argv[2]) if len(sys.argv) > 2 else 50000
    generate_seed_sql(out_file, num_patients=200, num_vitals=count)
