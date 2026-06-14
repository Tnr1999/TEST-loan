-- ═══════════════════════════════════════════════
-- Phase 9 — กันเลขบัตรซ้ำที่ระดับฐานข้อมูล (ชั้นสุดท้าย)
-- รันใน Supabase SQL Editor
-- ═══════════════════════════════════════════════
-- เสริมจากการตรวจฝั่งแอป (findExistingPerson) — กันแม้โค้ดพลาด/ยิงตรง API
-- ⚠️ ถ้ามีเลขบัตรซ้ำอยู่เดิม การสร้าง index จะ FAIL → ต้องเคลียร์ก่อน

-- ── ขั้นที่ 1: เช็คว่ามีเลขบัตรซ้ำอยู่ไหม (รันก่อน) ──
-- ถ้าได้ผลลัพธ์ = มีซ้ำ ต้องไปแก้/รวม person ให้เหลือเลขเดียวต่อคนก่อน
--   select id_card, count(*) c, array_agg(id) ids
--   from persons
--   where id_card is not null and btrim(id_card) <> ''
--   group by id_card having count(*) > 1;

-- ── ขั้นที่ 2: บังคับ unique (เฉพาะที่มีเลขบัตรจริง) ──
-- ใช้ partial unique index → person ที่ยังไม่มีเลขบัตร (ข้อมูลเก่า) ไม่ถูกกระทบ
create unique index if not exists persons_id_card_uniq
  on persons (id_card)
  where id_card is not null and btrim(id_card) <> '';
