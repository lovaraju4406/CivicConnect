import { Outlet } from "react-router-dom";
import Footer from "./Footer";

export default function DashboardLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f0f2f7]">
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}