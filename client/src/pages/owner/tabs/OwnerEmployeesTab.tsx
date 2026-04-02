import { Loader2, Trash2, UserPlus, X } from "lucide-react";
import type { FormEvent } from "react";
import { useOwnerDashboard } from "../ownerDashboardContext";

export default function OwnerEmployeesTab() {
  const {
    setError,
    staffMembers,
    staffMessage,
    staffModalOpen,
    setStaffModalOpen,
    staffForm,
    setStaffForm,
    staffSubmitting,
    staffDeletingId,
    createStaffAccount,
    removeStaffAccount
  } = useOwnerDashboard();

  function openModal(): void {
    setError(null);
    setStaffModalOpen(true);
  }

  return (
    <div className="owner-dash__panel">
      <h2 className="owner-dash__h2">พนักงานในสาขา</h2>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#636366" }}>
        สร้างบัญชีให้พนักงาน (ไม่มีการสมัครแบบสาธารณะ)
      </p>

      <button type="button" className="owner-dash__btn-primary owner-dash__btn-primary--fit" onClick={openModal}>
        <UserPlus size={18} strokeWidth={2} aria-hidden />
        เพิ่มพนักงาน
      </button>

      {staffMessage ? (
        <div
          className="owner-dash__card"
          style={{ marginTop: 12, borderLeft: "4px solid var(--green, #2e7d32)" }}
          role="status"
        >
          {staffMessage}
        </div>
      ) : null}

      <div style={{ marginTop: 14 }}>
        {staffMembers.length === 0 ? (
          <div className="owner-dash__card owner-dash__card--muted">
            <p style={{ margin: 0, textAlign: "center", color: "#636366" }}>ยังไม่มีพนักงาน</p>
          </div>
        ) : (
          staffMembers.map((member) => (
            <div key={member.id} className="owner-dash__card" style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{member.fullName}</div>
                  <div style={{ fontSize: 12, color: "#636366", marginTop: 4 }}>
                    @{member.username}
                    {member.phone ? ` · ${member.phone}` : ""}
                    <br />
                    {member.role === "SALES" ? "ฝ่ายขาย" : "ฝ่ายซ่อม/เคลม"} · ยอดขาย {member.totalSales} รายการ
                  </div>
                </div>
                <button
                  type="button"
                  className="crow-icon-btn"
                  onClick={() => void removeStaffAccount(member)}
                  disabled={staffDeletingId === member.id}
                  aria-label={staffDeletingId === member.id ? "กำลังลบ" : "ลบ"}
                  title={staffDeletingId === member.id ? "กำลังลบ" : "ลบ"}
                >
                  {staffDeletingId === member.id ? (
                    <Loader2 size={18} strokeWidth={2} className="crow-icon-btn__spin" aria-hidden />
                  ) : (
                    <Trash2 size={18} strokeWidth={2} aria-hidden />
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {staffModalOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="owner-add-staff-title"
          onClick={() => {
            if (!staffSubmitting) {
              setStaffModalOpen(false);
            }
          }}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 id="owner-add-staff-title" className="h-with-icon">
                <UserPlus size={20} strokeWidth={2} aria-hidden />
                เพิ่มพนักงาน
              </h3>
              <button
                type="button"
                className="modal-close"
                aria-label="ปิดหน้าต่างเพิ่มพนักงาน"
                onClick={() => setStaffModalOpen(false)}
                disabled={staffSubmitting}
              >
                <X size={18} strokeWidth={2.5} aria-hidden />
              </button>
            </div>
            <form
              onSubmit={(e: FormEvent<HTMLFormElement>) => {
                void createStaffAccount(e);
              }}
            >
              <div className="frow">
                <div className="fg">
                  <label>ชื่อ–นามสกุล</label>
                  <input
                    value={staffForm.fullName}
                    onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
                    autoComplete="name"
                    required
                    disabled={staffSubmitting}
                  />
                </div>
                <div className="fg">
                  <label>ชื่อผู้ใช้ (ใช้เข้าสู่ระบบ)</label>
                  <input
                    type="text"
                    value={staffForm.username}
                    onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
                    autoComplete="username"
                    required
                    disabled={staffSubmitting}
                  />
                </div>
              </div>
              <div className="frow">
                <div className="fg">
                  <label>รหัสผ่าน (อย่างน้อย 8 ตัว)</label>
                  <input
                    type="password"
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    disabled={staffSubmitting}
                  />
                </div>
                <div className="fg">
                  <label>บทบาท</label>
                  <select
                    value={staffForm.role}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, role: e.target.value as "SALES" | "REPAIRS" })
                    }
                    disabled={staffSubmitting}
                  >
                    <option value="SALES">ฝ่ายขาย</option>
                    <option value="REPAIRS">ฝ่ายซ่อม/เคลม</option>
                  </select>
                </div>
                <div className="fg">
                  <label>เบอร์โทร (ไม่บังคับ)</label>
                  <input
                    type="tel"
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                    autoComplete="tel"
                    disabled={staffSubmitting}
                  />
                </div>
              </div>
              <button className="btnok with-icon" type="submit" disabled={staffSubmitting}>
                <UserPlus size={18} strokeWidth={2} aria-hidden />
                {staffSubmitting ? "กำลังสร้าง…" : "สร้างบัญชีพนักงาน"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
