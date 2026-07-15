-- Phase 16: ย้าย "ลิงก์กลุ่มเฟส" จากตัวคน (persons) → ตัวสัญญา (loans) — รันครั้งเดียวใน SQL Editor
-- เหตุผล: ลูกค้าคนเดียวกู้หลายบ้าน = อยู่หลายกลุ่มเฟส เก็บที่คนมีช่องเดียวจะทับกันข้ามบ้าน
-- เก็บที่สัญญา = แต่ละบ้านมีลิงก์ของตัวเอง · ค่าเดิมใน persons คัดลอกมาให้สัญญาที่ยังไม่มี

alter table loans add column if not exists fb_group_url text;

update loans l
set fb_group_url = p.fb_group_url
from persons p
where p.id = l.person_id
  and l.fb_group_url is null
  and p.fb_group_url is not null;
