-- Migration: แทนที่ QR code ด้วย ชื่อธนาคาร + เลขบัญชี
-- รันใน Supabase SQL Editor ครั้งเดียว

ALTER TABLE persons ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS bank_account TEXT;
