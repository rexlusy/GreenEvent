import { AuthPanel } from "@/components/auth-panel.jsx";

export const metadata = { title: "Buat akun peserta" };
export default function Page({ searchParams }) {
  return <AuthPanel signup searchParams={searchParams} />;
}
