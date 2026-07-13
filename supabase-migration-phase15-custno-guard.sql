-- Phase 15: กันรหัสลูกค้า (cust_no) ซ้ำข้ามคน ระดับ DB — รันครั้งเดียวใน SQL Editor
-- ที่มา: เครื่องที่ข้อมูลค้าง/แอปเวอร์ชันเก่า ออกเลขทับกันได้ → trigger นี้สลับเป็นเลขว่างถัดไปให้อัตโนมัติ
-- (คนเดิมในบ้านเดิมยังใช้เลขเดิมได้ตามกติกาเปิดยอดใหม่)

create or replace function guard_cust_no() returns trigger as $fn$
begin
  if new.cust_no is not null and exists (
    select 1 from loans
    where branch_id = new.branch_id and cust_no = new.cust_no and person_id <> new.person_id
  ) then
    new.cust_no := (select coalesce(max(cust_no),0)+1 from loans where branch_id = new.branch_id);
  end if;
  return new;
end $fn$ language plpgsql;

drop trigger if exists trg_guard_cust_no on loans;
create trigger trg_guard_cust_no before insert or update of cust_no on loans
for each row execute function guard_cust_no();
