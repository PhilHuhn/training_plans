import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function RootPage() {
  const jar = await cookies();
  const token = jar.get("access_token");
  if (token) {
    redirect("/training");
  }
  redirect("/login");
}
