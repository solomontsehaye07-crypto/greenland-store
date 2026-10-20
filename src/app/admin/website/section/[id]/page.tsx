import { redirect } from "next/navigation";

// Sections are edited in the side panel of the home page editor now.
export default async function EditSection({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/admin/website?edit=${(await params).id}`);
}
