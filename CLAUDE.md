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
- **ค่าแรง (wage)** = `ดอกเบี้ยที่เก็บได้ × 20%`
- **จ่ายเกินดอกเบี้ย** → ส่วนเกินไปลดต้น (`principal_reduced`)
- **ยอดปิดสัญญา** = `ต้นคงเหลือ + ดอกเบี้ยรอบนี้ + ค่าธรรมเนียมบ้าน`
- สถานะการชำระ: `unpaid` / `partial` / `exact` / `overpaid`
- **ค่าปรับ (penalty)** = กรอกเองตอนรับเงิน (เติม default จาก `branches.penalty_fee`), **แยกจากดอก/ต้น ไม่คิดค่าแรง 20%**, เก็บที่ `daily_records.penalty`

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
- ระบบ **ค่าปรับ** (penalty) — ตั้ง default ระดับบ้าน, กรอกตอนรับเงิน, แสดงในประวัติ *(ต้องรัน `supabase-migration-phase2-penalty.sql` ก่อน)*

**ค้างอยู่ (ยังไม่ทำ)**
- หน้า **สรุปยอด 6 ตัว** (อาจรวมยอดค่าปรับด้วย)
