import DateInvitation from "@/components/DateInvitation";

export default async function InvitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <DateInvitation invitationSlug={slug} />;
}