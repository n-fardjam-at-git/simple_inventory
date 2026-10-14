import { requireRoles } from "@/lib/auth";
import { PageTitle, Card } from "@/components/ui";
import { NewProductForm } from "../../NewProductForm";

export default async function NewChargePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRoles(["admin"]);
  const params = await searchParams;
  const errorText = params.error ? decodeURIComponent(params.error) : null;

  return (
    <div>
      <PageTitle title="New charge" />
      {errorText ? (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errorText}
        </p>
      ) : null}
      <Card>
        <NewProductForm kind="charge" />
      </Card>
    </div>
  );
}
