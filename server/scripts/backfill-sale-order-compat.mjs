import "dotenv/config";
import { PrismaClient, InventoryDirection } from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply"),
    notesOnly: argv.includes("--notes-only"),
    limit: (() => {
      const raw = argv.find((arg) => arg.startsWith("--limit="));
      if (!raw) return null;
      const n = Number(raw.split("=")[1]);
      return Number.isFinite(n) && n > 0 ? n : null;
    })(),
  };
}

async function main() {
  const { apply, notesOnly, limit } = parseArgs(process.argv.slice(2));

  const legacySaleNoteRows = await prisma.inventoryMovement.findMany({
    where: {
      direction: InventoryDirection.OUT,
      note: {
        startsWith: "Sale ",
      },
    },
    select: {
      id: true,
      note: true,
      qty: true,
      deskItemId: true,
    },
    orderBy: { createdAt: "asc" },
    ...(limit ? { take: limit } : {}),
  });

  const noteUpdates = legacySaleNoteRows
    .map((row) => {
      const current = String(row.note || "");
      if (current.startsWith("Sale Order ")) return null;
      if (!current.startsWith("Sale ")) return null;
      return {
        id: row.id,
        from: current,
        to: current.replace(/^Sale\s+/, "Sale Order "),
      };
    })
    .filter(Boolean);

  let missingSaleRows = [];
  if (!notesOnly) {
    const sales = await prisma.saleRecord.findMany({
      select: {
        id: true,
        deskType: true,
        quantity: true,
        orderNumber: true,
        createdByUserId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      ...(limit ? { take: limit } : {}),
    });

    missingSaleRows = [];
    for (const sale of sales) {
      const existing = await prisma.inventoryMovement.findFirst({
        where: {
          direction: InventoryDirection.OUT,
          note: {
            contains: sale.orderNumber,
          },
        },
        select: { id: true },
      });
      if (!existing) {
        missingSaleRows.push({
          saleId: sale.id,
          orderNumber: sale.orderNumber,
          deskItemId: sale.deskType,
          qty: sale.quantity,
          createdByUserId: sale.createdByUserId || null,
          createdAt: sale.createdAt,
        });
      }
    }
  }

  console.log("Legacy note rows matched:", legacySaleNoteRows.length);
  console.log("Note rows to rename to 'Sale Order ...':", noteUpdates.length);
  if (!notesOnly) {
    console.log("Sales missing OUT movement rows:", missingSaleRows.length);
  }

  console.log("Sample note updates:");
  console.table(
    noteUpdates.slice(0, 10).map((u) => ({
      id: u.id,
      from: u.from,
      to: u.to,
    }))
  );

  if (!notesOnly) {
    console.log("Sample missing sales:");
    console.table(
      missingSaleRows.slice(0, 10).map((s) => ({
        orderNumber: s.orderNumber,
        qty: s.qty,
        deskItemId: s.deskItemId,
      }))
    );
  }

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to execute updates.");
    return;
  }

  await prisma.$transaction(
    noteUpdates.map((u) =>
      prisma.inventoryMovement.update({
        where: { id: u.id },
        data: { note: u.to },
      })
    )
  );

  if (!notesOnly && missingSaleRows.length > 0) {
    await prisma.inventoryMovement.createMany({
      data: missingSaleRows.map((s) => ({
        deskItemId: s.deskItemId,
        inventoryLotId: null,
        direction: InventoryDirection.OUT,
        qty: s.qty,
        note: `Sale Order ${s.orderNumber} (legacy backfill)`,
        createdByUserId: s.createdByUserId,
        createdAt: s.createdAt,
      })),
    });
  }

  console.log("Backfill applied successfully.");
  console.log("Renamed note rows:", noteUpdates.length);
  if (!notesOnly) {
    console.log("Created missing OUT movement rows:", missingSaleRows.length);
  }
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
