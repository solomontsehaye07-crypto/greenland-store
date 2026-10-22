import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertStaff, MANAGER_ROLES, requireStaff } from "@/lib/auth";
import { Card, Notice, PageHead } from "@/components/admin/ui";
import { getStockKeys, saveStockKeys } from "@/lib/stock-photos";
import { MediaLibrary } from "./media-library";

export const dynamic = "force-dynamic";

async function saveKeys(fd: FormData) {
  "use server";
  await assertStaff(MANAGER_ROLES);
  const keys = await getStockKeys();
  for (const k of ["unsplash", "pexels"] as const) {
    const v = String(fd.get(k) ?? "").trim();
    if (fd.get(`${k}__clear`) === "on") delete keys[k];
    else if (v) keys[k] = v;
  }
  await saveStockKeys(keys);
  revalidatePath("/admin/website/media");
  redirect(`/admin/website/media?msg=${encodeURIComponent("Photo library keys saved. Open any image field → Media library → Free photos.")}`);
}

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireStaff();
  const [{ msg }, keys] = await Promise.all([searchParams, getStockKeys()]);
  const field = (k: "unsplash" | "pexels", label: string, ph: string) => (
    <div>
      <label className="label" htmlFor={k}>{label}</label>
      <input id={k} name={k} type="password" autoComplete="off" placeholder={keys[k] ? "•••••••• (leave empty to keep)" : ph} className="input font-mono text-sm" />
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{keys[k] ? `saved · ends in ${keys[k]!.slice(-4)}` : "not set"}</span>
        {keys[k] && <label className="flex items-center gap-1"><input type="checkbox" name={`${k}__clear`} /> remove</label>}
      </div>
    </div>
  );
  return (
    <div>
      <PageHead title="Media" text="Every image you uploaded and every product photo, in one place. Anything here can be picked in any image field: products, home page, designs and pages." />
      <Notice msg={msg} />
      <Card
        className="mb-5"
        title="Free photo libraries"
        text={<>Search Unsplash and Pexels from every image field (tab “Free photos”). Both are free for shop use. Get a key at <b>unsplash.com/developers</b> (“Access Key”) and <b>pexels.com/api</b>, and paste it here yourself – keys are stored encrypted. One of the two is enough.</>}
      >
        <form action={saveKeys} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("unsplash", "Unsplash Access Key", "Access key from your Unsplash app")}
            {field("pexels", "Pexels API key", "API key from pexels.com/api")}
          </div>
          <button className="btn btn-primary">Save keys</button>
        </form>
      </Card>
      <MediaLibrary />
    </div>
  );
}
