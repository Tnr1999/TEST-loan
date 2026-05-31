-- ============================================================
-- ข้อมูลตัวอย่าง: 2 กอง / 3 บ้าน / บ้านละ 5 คน (รวม 15 ลูกค้า)
-- รันใน Supabase SQL Editor (รันทั้งบล็อกทีเดียว)
-- หมายเหตุ: เป็นข้อมูลเพิ่มเติม (additive) ไม่ลบของเดิม
-- ============================================================

do $$
declare
  g1 uuid; g2 uuid;
  branch_ids uuid[] := '{}';
  b uuid; pid uuid;
  fnames text[] := array[
    'สมชาย ใจดี','สมหญิง รักงาน','มานพ ตั้งใจ','ปราณี ศรีสุข','วิชัย พงษ์ไทย',
    'สุดา มีทรัพย์','ธีระ วงศ์ทอง','กนกพร แสงเดือน','อนุชา บุญมาก','ชลิตา ผ่องใส',
    'ณรงค์ ชัยชนะ','พรทิพย์ งามตา','สุริยา เรืองศรี','มาลี ดอกไม้','เอกพล มั่นคง'
  ];
  principals numeric[] := array[5000, 10000, 8000, 15000, 12000];
  rates      numeric[] := array[0.10, 0.08, 0.10, 0.05, 0.10];
  intervals  int[]     := array[1, 1, 2, 3, 1];
  i int; j int; idx int; fee numeric;
begin
  -- กอง
  insert into groups(name) values ('กองเหนือ') returning id into g1;
  insert into groups(name) values ('กองใต้')   returning id into g2;

  -- บ้าน (3 หลัง)
  insert into branches(name, fee_per_person, group_id) values ('บ้านสุขสันต์', 100, g1) returning id into b;
  branch_ids := array_append(branch_ids, b);
  insert into branches(name, fee_per_person, group_id) values ('บ้านรุ่งเรือง', 100, g1) returning id into b;
  branch_ids := array_append(branch_ids, b);
  insert into branches(name, fee_per_person, group_id) values ('บ้านมั่งมี', 150, g2) returning id into b;
  branch_ids := array_append(branch_ids, b);

  -- ลูกค้า: บ้านละ 5 คน (คน + สัญญา)
  idx := 1;
  for i in 1..3 loop
    select fee_per_person into fee from branches where id = branch_ids[i];
    for j in 1..5 loop
      insert into persons(full_name, phone)
        values (fnames[idx], '08' || lpad((10000000 + idx*137)::text, 8, '0'))
        returning id into pid;
      insert into loans(person_id, branch_id, principal, remaining_principal,
                        daily_interest_rate, collection_interval, start_date, status, branch_fee)
        values (pid, branch_ids[i], principals[j], principals[j],
                rates[j], intervals[j], current_date - (idx * 2), 'normal', fee);
      idx := idx + 1;
    end loop;
  end loop;
end $$;
