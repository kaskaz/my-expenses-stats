import Dashboard from "@/components/dashboard";
import { getSession, isConfigured } from "@/lib/session";
export const dynamic = "force-dynamic";
export default async function Home() {
  const session = await getSession();
  return <Dashboard authenticated={Boolean(session)} userName={session?.name ?? ""} configured={isConfigured()} />;
}
