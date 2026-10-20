import { requireStaff } from "@/lib/auth";
import { PageHead } from "@/components/admin/ui";
import { MediaLibrary } from "./media-library";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  await requireStaff();
  return (
    <div>
      <PageHead title="Media" text="Every image you uploaded and every product photo, in one place. Anything here can be picked in any image field: products, home page, designs and pages." />
      <MediaLibrary />
    </div>
  );
}
