-- ============================================================
-- Phase 1 Migration: กอง → บ้าน → ลูกค้า + แยก persons / loans
-- รันใน Supabase SQL Editor (รันทั้งไฟล์ทีเดียวได้)
--
-- ⚠️ คำเตือน: สคริปต์นี้ "ลบ" ตาราง customers และ daily_records เดิมทิ้ง
--    ใช้ได้เพราะตกลงกันแล้วว่า "ยังไม่มีข้อมูลจริง" (เริ่มใหม่สะอาด)
--    ถ้ามีข้อมูลที่อยากเก็บ ให้สำรองก่อนรัน
--
-- ⚠️ ต้องรัน 2 ขั้น:
--    ขั้นที่ 1) รันบรรทัด ALTER TYPE ข้างล่างนี้ "ก้อนเดียว" ก่อน
--              (users.role เป็น enum user_role — เพิ่มค่า 'head' เข้า enum
--               ห้ามอยู่ใน transaction block เดียวกับที่นำไปใช้)
--    ขั้นที่ 2) แล้วค่อยรันส่วน begin; ... commit; ที่เหลือ
-- ============================================================

-- ───────── ขั้นที่ 1 (รันก้อนนี้ก่อน ห้ามรวมกับ begin/commit) ─────────
alter type user_role add value if not exists 'head';


-- ───────── ขั้นที่ 2 (รันหลังขั้นที่ 1 สำเร็จแล้ว) ─────────
begin;

-- ------------------------------------------------------------
-- 1) groups (กอง) — ชั้นบนสุดใต้เจ้าของ
-- ------------------------------------------------------------
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 2) branches (บ้าน) — เพิ่ม group_id บอกว่าบ้านนี้อยู่กองไหน
--    (คงชื่อ schema ว่า branches เพื่อลดการรื้อโค้ด)
-- ------------------------------------------------------------
alter table branches
  add column if not exists group_id uuid references groups(id) on delete set null;

create index if not exists idx_branches_group on branches(group_id);

-- ------------------------------------------------------------
-- 3) persons (คน) — ตัวตนของลูกค้า แยกออกจากสัญญา
--    1 คน = 1 แถว (ชื่อ/เบอร์/บัตร) ไม่ว่าจะกู้กี่ที่
-- ------------------------------------------------------------
create table if not exists persons (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  id_card text,
  facebook_url text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 4) ลำดับลูกค้า/สัญญา (seq) — รันต่อเนื่องทั้งระบบ (global)
--    ไม่รีเซ็ตต่อบ้าน/กอง
-- ------------------------------------------------------------
create sequence if not exists loan_seq start 1;

-- ------------------------------------------------------------
-- 5) ลบของเก่า (ไม่มีข้อมูลจริง) — daily_records ก่อนเพราะอ้างถึง customers
-- ------------------------------------------------------------
drop table if exists daily_records cascade;
drop table if exists customers cascade;

-- ------------------------------------------------------------
-- 6) loans (สัญญา) — แทนที่ customers เดิม
--    ผูก person_id (คน) + branch_id (บ้าน)
-- ------------------------------------------------------------
create table loans (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references persons(id) on delete cascade,
  branch_id uuid not null references branches(id),
  seq integer not null default nextval('loan_seq'),
  principal numeric not null,
  remaining_principal numeric not null,
  daily_interest_rate numeric not null default 0.10,
  collection_interval integer not null default 1,
  start_date date not null default current_date,
  last_collection_date date,
  status text not null default 'normal',   -- normal / overdue / lost / closed
  branch_fee numeric default 0,
  close_amount numeric,
  created_at timestamptz default now()
);

create index if not exists idx_loans_person   on loans(person_id);
create index if not exists idx_loans_branch   on loans(branch_id);
create index if not exists idx_loans_status   on loans(status);

-- ------------------------------------------------------------
-- 7) daily_records — เปลี่ยน customer_id → loan_id
-- ------------------------------------------------------------
create table daily_records (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id) on delete cascade,
  record_date date not null,
  interest_due numeric,
  amount_paid numeric,
  interest_collected numeric,
  principal_reduced numeric,
  remaining_principal numeric,
  wage numeric,
  payment_status text,
  recorded_by uuid references users(id),
  created_at timestamptz default now()
);

create index if not exists idx_records_loan on daily_records(loan_id);
create index if not exists idx_records_date on daily_records(record_date);

-- ------------------------------------------------------------
-- 8) user_groups (หัวหน้ากอง ↔ กองที่ดูแล)
--    user_branches เดิมคงไว้ (staff ↔ บ้าน)
-- ------------------------------------------------------------
create table if not exists user_groups (
  user_id  uuid references users(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  primary key (user_id, group_id)
);

-- ------------------------------------------------------------
-- 9) Role: manager → head
-- ------------------------------------------------------------
update users set role = 'head' where role = 'manager';

-- ------------------------------------------------------------
-- 10) ปิด RLS ของตารางใหม่ให้ตรงกับตารางเดิม (branches/users)
--     แอปเข้าถึงด้วย anon key โดยตรง ถ้าไม่ปิด RLS จะถูกบล็อก
--     ("new row violates row-level security policy")
-- ------------------------------------------------------------
alter table groups        disable row level security;
alter table persons       disable row level security;
alter table loans         disable row level security;
alter table daily_records disable row level security;
alter table user_groups   disable row level security;

commit;

-- ============================================================
-- หมายเหตุเรื่องสิทธิ์ (RLS)
-- ขั้นที่ 10 ปิด RLS ของตารางใหม่แล้ว เพื่อให้ anon key เข้าถึงได้
-- เหมือนตารางเดิม (เพราะแอปนี้ใช้ตาราง users เองในการ login
-- ไม่ได้ใช้ Supabase Auth จึงไม่พึ่ง RLS เป็นชั้นความปลอดภัย)
-- ============================================================
