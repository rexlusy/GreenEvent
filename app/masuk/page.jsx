import { AuthPanel } from "@/components/auth-panel.jsx";

export const metadata = { title: "Masuk" };
export default function Page({ searchParams }) {
  return <AuthPanel searchParams={searchParams} />;
}
