-- ═══════════════════════════════════════════════════════════
-- Phase 5: รหัสลูกค้า = รหัสบ้าน + เลขลำดับในบ้าน (เช่น AA01)
--   branches.code  = รหัสบ้าน (กรอกเองที่หน้าตั้งค่า เช่น AA, EVE)
--   loans.cust_no  = เลขลำดับของลูกค้า "ต่อบ้าน" (คงที่ถาวร · ต่อคน)
-- ลูกค้าคนเดิมในบ้านเดิมที่เปิดยอดใหม่ = ใช้เลขเดิม (รหัสผูกกับตัวคน)
-- ═══════════════════════════════════════════════════════════

alter table branches add column if not exists code text;
alter table loans    add column if not exists cust_no integer;

-- backfill: แจกเลขให้สัญญาเดิม — เรียงต่อ (บ้าน, คน) ตามสัญญาแรกสุดของคนนั้นในบ้าน
with firsts as (
  select branch_id, person_id, min(seq) as pmin
  from loans
  group by branch_id, person_id
), numbered as (
  select branch_id, person_id,
    dense_rank() over (partition by branch_id order by pmin, person_id) as num
  from firsts
)
update loans l
set cust_no = n.num
from numbered n
where l.branch_id = n.branch_id
  and l.person_id = n.person_id
  and l.cust_no is null;
