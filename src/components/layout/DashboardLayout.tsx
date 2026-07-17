import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import Footer from "./Footer";

export default function DashboardLayout({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        <TopBar title={title} />
        <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
