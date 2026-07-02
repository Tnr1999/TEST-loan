-- Phase 12: ลิงก์กลุ่มเฟส (ต่อลูกค้า) — แยกจาก Facebook URL ส่วนตัวเดิม
-- เก็บลิงก์กลุ่ม/เพจเฟสที่เกี่ยวข้องกับลูกค้าคนนั้น (เช่น กลุ่มขายของ, เพจร้าน)

ALTER TABLE persons ADD COLUMN IF NOT EXISTS fb_group_url text;
