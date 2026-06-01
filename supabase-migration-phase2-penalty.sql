-- ============================================================
-- Phase 2 — ระบบค่าปรับ (penalty)
-- รันครั้งเดียวใน Supabase SQL Editor
-- ปลอดภัย: ใช้ "add column if not exists" รันซ้ำได้ไม่พัง
-- ============================================================

-- ค่าปรับมาตรฐานของบ้าน (ใช้เป็นค่า default เติมตอนรับเงิน)
alter table branches      add column if not exists penalty_fee numeric default 0;

-- ค่าปรับที่เก็บจริงในแต่ละวัน (แยกจากดอก/ต้น ไม่คิดค่าแรง 20%)
alter table daily_records add column if not exists penalty     numeric default 0;
