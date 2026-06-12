-- ═══════════════════════════════════════════════════════════
-- PHASE 4 — ยอดเบิก (disbursements)
-- เงินที่โอนให้ลูกค้า: เปิดสัญญาใหม่ (kind='new') + เพิ่มยอด/ปรับเพิ่ม (kind='topup')
-- รันครั้งเดียวบน Supabase (SQL Editor)
-- ═══════════════════════════════════════════════════════════

create table if not exists disbursements (
  id           uuid primary key default gen_random_uuid(),
  loan_id      uuid not null references loans(id) on delete cascade,
  branch_id    uuid references branches(id),
  amount       numeric not null,                  -- ยอดที่โอนให้ครั้งนี้ (บาท)
  disburse_date date not null default current_date,-- วันที่โอน (ใช้รวมยอดเบิกรายวัน)
  kind         text not null default 'new',       -- 'new' = เปิดใหม่ · 'topup' = เพิ่มยอด
  recorded_by  uuid,
  created_at   timestamptz default now()
);

create index if not exists idx_disbursements_date   on disbursements(disburse_date);
create index if not exists idx_disbursements_loan   on disbursements(loan_id);
create index if not exists idx_disbursements_branch on disbursements(branch_id);

-- เปิด RLS ให้เหมือนตารางอื่น (ปรับ policy ตามระบบสิทธิ์ของคุณ)
alter table disbursements enable row level security;
do $$ begin
  create policy "disbursements all" on disbursements for all using (true) with check (true);
exception when duplicate_object then null; end $$;
