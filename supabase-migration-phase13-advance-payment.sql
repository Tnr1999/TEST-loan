-- Phase 13: จ่ายล่วงหน้า (Advance Payment)
-- บันทึกจำนวนงวดที่จ่ายล่วงหน้าไว้ต่อรายการ (สำหรับโชว์ป้าย "ล่วงหน้า +N งวด" ในประวัติการชำระ)
-- ต้องรันก่อนใช้ปุ่ม "ล่วงหน้า" — ไม่งั้นบันทึกรายการจ่ายล่วงหน้าจะล้มเหลว (คอลัมน์ไม่มีในตาราง)

ALTER TABLE daily_records ADD COLUMN IF NOT EXISTS advance_cycles integer DEFAULT 0;
