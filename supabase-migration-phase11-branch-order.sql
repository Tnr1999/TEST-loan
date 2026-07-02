-- Phase 11: ลำดับการแสดงบ้าน (ลากจัดลำดับในหน้าตั้งค่า)
-- เพิ่มคอลัมน์ sort_order ให้ตาราง branches · ค่าว่าง (NULL) = เรียงตาม created_at เดิม
-- โค้ดฝั่ง frontend เป็น fail-safe: ถ้ายังไม่รันไฟล์นี้ แอปยังทำงานปกติ (แค่ลากจัดลำดับไม่ได้)

ALTER TABLE branches ADD COLUMN IF NOT EXISTS sort_order integer;

-- ตั้งค่าเริ่มต้นให้บ้านที่มีอยู่แล้ว = เรียงตามลำดับที่สร้าง (ต่อกอง)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY group_id ORDER BY created_at) - 1 AS rn
  FROM branches
)
UPDATE branches b SET sort_order = o.rn
FROM ordered o WHERE b.id = o.id AND b.sort_order IS NULL;
