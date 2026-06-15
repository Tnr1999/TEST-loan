-- ============================================================
-- Phase 10 — โหมด "ผ่อนต้น" (principal-only)
-- ลูกค้าจ่ายดอกไม่ไหว → หยุดคิดดอก ทยอยผ่อนแต่เงินต้นจนหมด
-- รันครั้งเดียวบน Supabase SQL editor
-- ============================================================
alter table loans add column if not exists principal_only boolean default false;
