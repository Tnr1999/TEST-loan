-- Phase 14: เปิด Realtime (อัปเดตสดข้ามเครื่อง — เครื่องอื่นบันทึกแล้วเห็นทันทีไม่ต้องรีเฟรช)
-- รันครั้งเดียวใน Supabase SQL Editor
-- เพิ่มตารางหลักเข้า publication ของ Realtime (เขียนแบบ idempotent — รันซ้ำไม่พัง)

do $$ begin
  alter publication supabase_realtime add table public.loans;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.daily_records;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.disbursements;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.persons;
exception when duplicate_object then null; end $$;
