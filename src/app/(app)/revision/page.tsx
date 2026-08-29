import { PendingCard } from "../../../components/pending-card";
import { requireUser } from "../../../lib/auth/guard";
import { prisma } from "../../../server/db/client";
import { confirmPendingAction, rejectPendingAction } from "./actions";

async function handleConfirm(pendingId: string): Promise<void> {
  "use server";
  await confirmPendingAction(pendingId);
}

async function handleReject(pendingId: string): Promise<void> {
  "use server";
  await rejectPendingAction(pendingId);
}

export default async function RevisionPage() {
  const user = await requireUser();
  if (!user.ok) {
    return null;
  }
  const userId = user.data;

  const pendings = await prisma.pendingTransaction.findMany({
    where: { userId, status: "awaiting_review" },
    orderBy: { createdAt: "asc" },
    include: { account: true, category: true },
  });

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-8 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-fg">Revisión</h1>
      {pendings.length === 0 ? (
        <p className="text-sm text-fg-muted">No hay pendientes por revisar.</p>
      ) : (
        <ul className="flex flex-col gap-6">
          {pendings.map((pending) => (
            <PendingCard
              key={pending.id}
              pending={{
                id: pending.id,
                rawInput: pending.rawInput,
                description: pending.description,
                amountCents: pending.amountCents,
                direction: pending.direction,
                accountName: pending.account?.name ?? null,
                categoryName: pending.category?.name ?? null,
              }}
              confirmAction={handleConfirm.bind(null, pending.id)}
              rejectAction={handleReject.bind(null, pending.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
