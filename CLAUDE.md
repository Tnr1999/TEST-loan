# CLAUDE.md — แผนที่โปรเจกต์ระบบสินเชื่อรายวัน

> ระบบจัดการสินเชื่อรายวัน (Daily Interest Loan) — เว็บแอปภาษาไทยล้วน
> Frontend = static (HTML/CSS/JS ธรรมดา ไม่มี build) · Backend = Supabase · Deploy = Vercel (push `main` → production อัตโนมัติ)

## โครงสร้างไฟล์ — แก้ที่ไหน?

| ไฟล์ | หน้าที่ | ฟังก์ชันหลัก |
|---|---|---|
| `index.html` | โครง HTML + ลิงก์ css/js เท่านั้น (ไม่มีโค้ดตรรกะ) | — |
| `css/style.css` | **ดีไซน์/สี/layout ทั้งหมด** | (CSS) |
| `js/core.js` | config, state, utils, สิทธิ์, **สูตรคำนวณ**, login, โหลดข้อมูล | `loadAll`, `interestDue`, `calcPayment`, `closeAmount`, `isPaymentDueToday`, `canEdit`, `fmt`, `toast` |
| `js/dashboard.js` | หน้าภาพรวม + สลับเมนู | `showPage`, `renderDashboard`, `stat` |
| `js/payments.js` | บันทึก/แก้ไขการรับเงิน | `openPayment`, `updatePayCalc`, `savePayment` |
| `js/customers.js` | **หน้าลูกค้า** (ลิสต์, ชิปกรอง, รายละเอียด, เพิ่ม/แก้) | `renderCustomers`, `setCustView`, `openDetail`, `openAddCustomer`, `saveCustomer` |
| `js/admin.js` | บ้าน + กอง + ผู้ใช้ | `renderBranches`, `renderGroups`, `renderUsers`, `saveBranch`, `saveGroup`, `saveUser` |
| `js/calendar.js` | ปฏิทินเลือกวันบน dashboard | `initCalendar`, `renderCalendar`, `calPick` |
| `js/init.js` | จุดเริ่มแอป (`DOMContentLoaded`) — **โหลดเป็นไฟล์สุดท้าย** | — |
| `supabase-migration-phase1.sql` | สร้างตาราง DB (รันครั้งเดียวตอนตั้งระบบ) | — |
| `supabase-seed-sample.sql` | ข้อมูลตัวอย่างไว้ทดสอบ | — |

## โครงสร้างข้อมูล (ลำดับชั้น)

```
กอง (group) → บ้าน (branch) → ลูกค้า (customer) → records (การชำระรายวัน)
```
ผู้ใช้มี role: `owner` / `head` / `staff` (ดูสิทธิ์ที่ `js/core.js` ส่วน PERMISSION)

## สูตรคำนวณสำคัญ (`js/core.js`)

- **ดอกเบี้ยที่ต้องเก็บ** = `ต้นคงเหลือ × อัตราดอกเบี้ยต่อวัน × จำนวนวันของรอบ`
- **ค่าแรง (wage)** = `(ดอกเบี้ยที่เก็บได้ + ค่าปรับ + ค่าธรรมเนียมบ้าน[เฉพาะวันปิดสัญญา]) × 20%`
- **จ่ายเกินดอกเบี้ย** → ส่วนเกินไปลดต้น (`principal_reduced`)
- **ยอดปิดสัญญา** = `ต้นคงเหลือ + ดอกเบี้ยรอบนี้ + ค่าธรรมเนียมบ้าน`
- สถานะการชำระ: `unpaid` / `partial` / `exact` / `overpaid`
- **ค่าปรับ (penalty)** = **คำนวณอัตโนมัติ ห้ามแก้** (`computePenalty` ใน `js/core.js`) — เส้นตายรอบ = 16:00 ของวันครบกำหนด · 16:00–22:00 คิดชั่วโมงละ `branches.penalty_per_hour` (ปัดขึ้น) · ตั้งแต่ 22:00 คิดเต็มวัน `branches.penalty_per_day` · ทุกวันถัดไปที่ค้าง +เต็มวัน · ใช้เวลาจริง Asia/Bangkok (บันทึกย้อนหลัง = เต็มวัน) · เก็บเฉพาะเมื่อมีการจ่ายจริง (จ่าย 0 = ไม่เก็บ). **แยกจากดอก/ต้น (ไม่กระทบยอดปิดสัญญา)** แต่**นับรวมในฐานคำนวณค่าแรง 20%**, เก็บที่ `daily_records.penalty` *(ต้องรัน `supabase-migration-phase3-penalty-auto.sql` ก่อน)*

## เอกสาร/เครื่องมือเพิ่มเติม

- `docs/DESIGN.md` — **คู่มือ UX/UI** (โทนสี, คอมโพเนนต์, กฎดีไซน์) อ่านก่อนแตะหน้าตา
- Skill `/polish-ui` — รีวิว+ขัดดีไซน์หน้าจอให้สวยและสม่ำเสมอตาม DESIGN.md

## กฎการพัฒนา

1. **UI ภาษาไทยล้วน**
2. แก้โค้ดในไฟล์ย่อยที่ตรงฟีเจอร์ (อย่ายัดกลับเข้า index.html)
3. **JS ใช้ `<script>` ธรรมดา ห้ามเปลี่ยนเป็น ES module** — เพราะ HTML มี inline `onclick` ~71 จุด ต้องการให้ฟังก์ชันอยู่ใน global scope
4. แก้ลำดับการโหลด script ใน index.html ระวัง: `init.js` ต้องอยู่ท้ายสุด, `core.js` ต้องอยู่หลัง Supabase CDN
5. พัฒนาบน branch `claude/...` → push → ลอง Vercel Preview → ค่อย merge `main`

## สถานะงาน

**เสร็จแล้ว**
- ลำดับชั้น กอง→บ้าน→ลูกค้า + สิทธิ์ตาม role
- หน้าลูกค้าใช้ง่ายสำหรับ 100+ คน: ชิปกรองด่วน (default = ต้องเก็บวันนี้), เรียงคนถึงกำหนดขึ้นบน, การ์ดกระชับแบบลิสต์, ปุ่มเลื่อนขึ้นบนสุด
- แยกไฟล์ CSS/JS ออกจาก index.html
- responsive 3 tier (PC/Tablet/มือถือ) + คู่มือ DESIGN.md + skill /polish-ui
- ระบบ **ค่าปรับ** (penalty) — ปัจจุบันเป็น**ช่องกรอกเอง**ตอนรับเงิน (ไม่ auto-calculate แล้ว แต่ `computePenalty` ยังอยู่ใน core.js เผื่อใช้อนาคต)
- **ค่าแรง (wage)** — ซ่อนจากสรุปยอด/กล่องคำนวณ แต่ยังคำนวณ+เก็บที่ `daily_records.wage` · นำกลับมาแสดงในหน้า **จ่ายเงินทีม** (ดูด้านล่าง)
- **ค่าแรง (แท็บแยก)** (`page-payout` · ทุก role เห็น แต่ staff เห็นแค่ของตัวเอง (`renderPayoutSelf`), owner/head เห็นสรุปทั้งทีม (`renderPayout`) · รายวันตามวันที่ที่เลือก · ใช้วันร่วมกับ dashboard/ลูกค้าผ่าน `#dash-date-picker`) — ค่าแรง 20% ของ "ยอดเข้า" (ดอกเก็บได้+ค่าปรับ+ค่าธรรมเนียมตอนปิด, เก็บใน `daily_records.wage`) − **คอม 5% ของ "ยอดเข้า"** (= ค่าแรง×5) หักจากค่าแรงของแต่ละคน → รวมเป็น "คอมของกอง" → จ่ายให้**หัวหน้ากอง** (รวมส่วนของหัวหน้าเองด้วย, = หัวหน้าสาย) · แยกตามกอง → รายคน = **พนักงานเจ้าของบ้าน** (`branches.staff_id` ถ้ากำหนดไว้ ไม่งั้น fallback เป็น `recorded_by` คนที่กดรับเงิน) → ค่าแรงเข้าเจ้าของบ้านเสมอ แม้หัวหน้ากอง/หัวหน้าสายเป็นคนกดรับเงินแทน · การ์ดหัวหน้าโชว์ที่มาคอมรายคน · กติกา **1 กอง = หัวหน้า 1 คน** (หา head จาก `user_groups`+role) · กองไม่มีหัวหน้า = ไม่หักคอม · **เจ้าของระบบ (owner) ไม่คิดค่าแรง/คอม** · `renderPayoutPage`/`renderPayout`/`renderPayoutSelf`/`groupHeadUser` ใน `js/dashboard.js` · ตั้งพนักงานเจ้าของบ้านได้ที่หน้าตั้งค่า → บ้าน (`branchForm` ใน `js/admin.js`) *(ต้องรัน `supabase-migration-phase6-branch-staff.sql` ก่อน)*
- **สรุปยอด** (รายวัน บน summary bar): ยอดรวมรับเงิน · ดอก · ค่าปรับ · **ยอดเบิก** · เงินต้นเก็บคืน · เงินต้นคงค้าง + แยกตามบ้าน (กอง→บ้าน)
- **ยอดเบิก** (disbursement) — เงินที่โอนให้ลูกค้า: เปิดสัญญาใหม่ (auto บันทึกตอนกด "เปิด" ยืนยันโอนเงิน) + เพิ่มยอด/โอนเพิ่ม (ปุ่ม "+ เพิ่มยอด" ในรายละเอียดลูกค้า, เพิ่มเข้าเงินต้นด้วย) *(ต้องรัน `supabase-migration-phase4-disbursements.sql` ก่อน)*

- **รหัสลูกค้า** = รหัสบ้าน + เลขลำดับในบ้าน 3 หลัก (เช่น `AA001`) — `branches.code` (กรอกเองหน้าตั้งค่า) + `loans.cust_no` (ต่อคน · คงที่ถาวร · เปิดยอดใหม่ใช้เลขเดิม) · helper `custCode`/`nextCustNo` ใน `js/core.js` · แสดงแทน seq ในตาราง/การ์ด/รายละเอียด/หัวข้อรับเงิน · ยังไม่ตั้งรหัสบ้าน = fallback เป็น `#seq` *(ต้องรัน `supabase-migration-phase5-codes.sql` ก่อน)*

**ค้างอยู่ (ยังไม่ทำ)**
- *(ครบตามแผนแล้ว — เพิ่มเติมตามต้องการ)*
