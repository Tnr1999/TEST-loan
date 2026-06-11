---
target: หน้าลูกค้า (customers)
total_score: 32
p0_count: 0
p1_count: 0
timestamp: 2026-06-11T17-41-47Z
slug: js-customers-js
---
## Design Health: 32/40 (Good) — รอบ 2 หลังเพิ่มปฏิทิน + แก้ P1/P2/P3

| # | Heuristic | Score | Note |
|---|-----------|-------|------|
| 1 | Visibility | 3 | แถบวันที่ + ไฮไลต์ not-today · ไม่มี loading state |
| 2 | Match Real World | 4 | คำเป็นกลางต่อวันที่ |
| 3 | User Control | 3 | เลื่อนวัน/รีเซ็ตได้ · ไม่มีปุ่มล้างค้นหา |
| 4 | Consistency | 4 | ปุ่ม action ทรงเดียว + ปฏิทิน reuse component |
| 5 | Error Prevention | 4 | showConfirm ครบ |
| 6 | Recognition | 3 | วันค้างบนการ์ดแล้ว · ตาราง PC ยังพึ่ง tooltip |
| 7 | Flexibility | 3 | เลือกได้ทุกวัน · ไม่มี bulk/คีย์ลัด |
| 8 | Minimalist | 3 | ชิปแถวเดียว · เพิ่มแถบวันที่ 1 แถว |
| 9 | Error Recovery | 3 | toast |
| 10 | Help | 2 | ไม่มี help/hint |

## Priority Issues (เหลือ)
- [P2] ตาราง PC พึ่ง tooltip (งวด/อัตรา/เก็บล่าสุด/ค่าธรรมเนียม) hover-only
- [P2] ไม่มีปุ่มล้างค้นหา/ฟิลเตอร์ (✕)
- [P3] ไม่มี help/hint ในหน้า
- [P3] ไม่มี bulk action (รับเงินทีละคน)

## Detector
- single-font + em-dash-overuse = false positive (3 ฟอนต์ผ่าน CSS var; em-dash = placeholder ค่าว่าง)

## Done รอบนี้
- P1 ผูกกับวันนี้อย่างเดียว → ปฏิทินเลือกวัน (วันร่วม dashboard)
- P2 วันค้างบนการ์ดมือถือ · P2 ชิปเลื่อนแถวเดียว · P3 action สม่ำเสมอ
