-- ============================================================
-- Phase 3 — ค่าปรับอัตโนมัติ (รายชั่วโมง + เต็มวัน)
-- รันครั้งเดียวใน Supabase SQL Editor
-- ปลอดภัย: ใช้ "add column if not exists" รันซ้ำได้ไม่พัง
-- ============================================================
--
-- โมเดล: เส้นตายของรอบ = 16:00 ของวันครบกำหนด
--   16:00–22:00 → คิดชั่วโมงละ penalty_per_hour (ปัดขึ้นทีละชั่วโมง)
--   ตั้งแต่ 22:00 เป็นต้นไป → คิดเป็นเต็มวัน penalty_per_day
--   ทุกวันถัดไปที่ยังค้าง → +penalty_per_day อีกวันละครั้ง
--   ระบบคำนวณเอง (staff แก้ไม่ได้) · เก็บผลที่ daily_records.penalty เดิม
-- ============================================================

-- เรทค่าปรับระดับบ้าน (แทนที่ penalty_fee เดิมที่เป็นค่าคงที่)
alter table branches add column if not exists penalty_per_hour numeric default 0;
alter table branches add column if not exists penalty_per_day  numeric default 0;

-- ย้ายค่าเดิม (ถ้ามี penalty_fee อยู่) มาเป็นค่าปรับ/วันเริ่มต้น เพื่อไม่ให้ข้อมูลหาย
update branches set penalty_per_day = penalty_fee
where penalty_fee is not null and penalty_fee > 0
  and coalesce(penalty_per_day,0) = 0;

-- หมายเหตุ: ไม่ลบคอลัมน์ penalty_fee เดิมทิ้ง (เผื่ออยากย้อนดู) — โค้ดเลิกใช้แล้ว
