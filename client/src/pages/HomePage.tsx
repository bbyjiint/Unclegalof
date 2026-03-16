import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <main className="landing">
      <section className="card">
        <h3>ย้ายมา React + TypeScript แล้ว</h3>
        <p>
          โปรเจกต์นี้ใช้ React + TypeScript สำหรับ frontend, Express สำหรับ API server และ Prisma
          สำหรับเชื่อมต่อ Neon PostgreSQL แล้ว โครงสร้างใหม่พร้อมสำหรับพัฒนาต่อแบบ full-stack
        </p>
        <div className="landing-links">
          <Link to="/staff">เปิดหน้าพนักงาน</Link>
          <Link to="/inventory">เปิดหน้าคลังสินค้า</Link>
          <Link to="/repair">เปิดหน้าซ่อม/เคลม</Link>
          <Link to="/owner">เปิดหน้าเจ้าของ</Link>
        </div>
      </section>
    </main>
  );
}
