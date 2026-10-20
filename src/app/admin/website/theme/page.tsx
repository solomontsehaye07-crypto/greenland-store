import { redirect } from "next/navigation";

// Colours are part of each design now.
export default function ThemePage() {
  redirect("/admin/website/designs");
}
