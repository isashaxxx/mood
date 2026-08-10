import Dashboard from "@/components/Dashboard";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser();
  return <Dashboard user={user} />;
}
