import Link from "next/link";
import { WebsiteTabs } from "@/components/admin/website/tabs";

export const metadata = { title: "Website" };

export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Website</h1>
          <p className="mt-1 text-sm text-muted">Every text, photo and colour on the shop. Changes go live as soon as you save.</p>
        </div>
        <Link href="/" target="_blank" className="btn btn-ghost py-2 text-sm">Open the shop</Link>
      </div>
      <WebsiteTabs />
      {children}
    </div>
  );
}
