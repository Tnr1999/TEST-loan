-- ═══════════════════════════════════════════════
-- Phase 8 — ระบบแจ้งเตือน Owner (กันลูกน้องโกง)
-- รันครั้งเดียวใน Supabase SQL Editor
-- ═══════════════════════════════════════════════
-- เก็บเหตุการณ์น่าสงสัยให้ Owner ไล่ตรวจย้อนหลัง:
--   dup_lost  = พยายามเปิดสัญญาใหม่ให้ลูกค้าที่มีสถานะ "ตาย" ค้างอยู่ (บล็อก + แจ้ง)
--   maybe_dup = สร้างลูกค้าใหม่ที่ "ใกล้เคียง" คนเดิม (เลขบัตรต่าง 1 หลัก / ชื่อคล้าย / เบอร์-บัญชีตรง) — log เงียบๆ
create table if not exists alerts (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  type          text not null,
  actor_user_id uuid,            -- ผู้ใช้ที่ทำรายการ
  actor_name    text,            -- ชื่อ ณ ตอนนั้น (กันผู้ใช้ถูกลบ)
  person_id     uuid,            -- ลูกค้าที่เกี่ยวข้อง
  person_name   text,
  branch_id     uuid,
  loan_id       uuid,
  message       text,
  meta          jsonb,
  is_read       boolean not null default false
);

create index if not exists alerts_created_idx on alerts(created_at desc);
create index if not exists alerts_unread_idx  on alerts(is_read);

-- โปรเจกต์นี้เข้าถึงผ่าน anon key ทั้งหมด (เหมือนตารางอื่น) → ปิด RLS
alter table alerts disable row level security;
