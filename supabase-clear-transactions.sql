-- ═══════════════════════════════════════════════════════════
-- เคลียร์ข้อมูลธุรกรรมทั้งหมด (เริ่มระบบใหม่สะอาด)
-- ลบ: daily_records, disbursements, loans, persons
-- เก็บไว้: groups, branches, users, user_groups (โครงสร้าง+สิทธิ์เดิม)
--
-- รันใน Supabase SQL Editor — รันทั้งไฟล์ทีเดียวได้ (อยู่ใน transaction)
-- ⚠️ ลบแล้วกู้คืนไม่ได้ ตรวจสอบให้แน่ใจก่อนรัน
-- ═══════════════════════════════════════════════════════════

begin;

delete from daily_records;
delete from disbursements;
delete from loans;
delete from persons;

-- รีเซ็ตเลขลำดับลูกค้า/สัญญา ให้เริ่มที่ 1 ใหม่
alter sequence loan_seq restart with 1;

commit;
