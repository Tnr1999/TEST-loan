---
target: หน้าลูกค้า (customers)
total_score: 30
p0_count: 0
p1_count: 1
timestamp: 2026-06-11T14-44-43Z
slug: js-customers-js
---
## Design Health: 30/40 (Good)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | tooltip (data-tip) ใช้ไม่ได้บนมือถือ |
| 2 | Match System / Real World | 4 | ภาษาไทย ตรงงานจริง |
| 3 | User Control and Freedom | 3 | ไม่มีปุ่มล้าง search/filter |
| 4 | Consistency and Standards | 3 | action column สลับ span-link กับ button |
| 5 | Error Prevention | 4 | showConfirm ครบ |
| 6 | Recognition Rather Than Recall | 3 | ข้อมูลค้างซ่อนใน tooltip |
| 7 | Flexibility and Efficiency | 2 | ผูกกับ "วันนี้" อย่างเดียว, ไม่มี bulk |
| 8 | Aesthetic and Minimalist | 3 | controls หนาบนมือถือ |
| 9 | Error Recovery | 3 | error เป็น toast |
| 10 | Help and Documentation | 2 | ไม่มี help ในหน้า |

## Priority Issues
- [P1] ผูกกับ "วันนี้" อย่างเดียว — ดูย้อนหลัง/ล่วงหน้าไม่ได้ → แก้ด้วยปฏิทินเลือกวัน (done)
- [P2] tooltip บนมือถือเข้าไม่ถึง — วันค้าง/อัตราดอกซ่อนใน data-tip → โชว์วันค้างบนการ์ด (done)
- [P2] controls หนาบนมือถือ — search+ปุ่มบ้าน+ชิป 6 อัน → ชิปเลื่อนแนวนอนแถวเดียว (done)
- [P3] action column ไม่สม่ำเสมอ — span-link ปนปุ่ม → ใช้ปุ่มทรงเดียวกันทุกสถานะ (done)

## Remaining (ยังไม่แตะ)
- [P2] ไม่มีปุ่มล้าง search/filter
- [P3] ไม่มี help/hint ในหน้า
- [P3] ไม่มี bulk action
