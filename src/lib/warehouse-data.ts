import { TransactionType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function getSuppliers() {
  return prisma.supplier.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export async function getProductRows() {
  const since = new Date(Date.now() - THIRTY_DAYS_MS);
  const products = await prisma.product.findMany({
    include: {
      supplier: true,
      inventoryBalances: {
        include: {
          location: true,
        },
      },
      inventoryTransactions: {
        where: {
          type: TransactionType.CUSTOMER_OUT,
          createdAt: {
            gte: since,
          },
        },
        select: {
          quantity: true,
        },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  return products.map((product) => {
    const khoTongQty = product.inventoryBalances.find((balance) => balance.location.code === "KHO_TONG")?.quantity ?? 0;
    const khoLeQty = product.inventoryBalances.find((balance) => balance.location.code === "KHO_LE")?.quantity ?? 0;
    const outbound30d = product.inventoryTransactions.reduce((sum, transaction) => sum + transaction.quantity, 0);

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      supplierId: product.supplierId,
      supplierName: product.supplier.name,
      status: product.status,
      isObsolete: product.isObsolete,
      khoTongQty,
      khoLeQty,
      totalQty: khoTongQty + khoLeQty,
      outbound30d,
    };
  });
}

export async function getInboundRows() {
  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      type: TransactionType.MANUFACTURER_IN,
    },
    include: {
      product: {
        include: {
          supplier: true,
        },
      },
      destinationLocation: true,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 20,
  });

  return transactions.map((transaction) => ({
    id: transaction.id,
    product: transaction.product.name,
    supplier: transaction.product.supplier.name,
    quantity: transaction.quantity,
    destination: transaction.destinationLocation?.name ?? "-",
    note: transaction.note ?? transaction.referenceNo ?? "-",
  }));
}

export async function getBasketRows() {
  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      type: TransactionType.CUSTOMER_OUT,
    },
    include: {
      product: true,
      sourceLocation: true,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 20,
  });

  return transactions.map((transaction) => ({
    id: transaction.id,
    sku: transaction.product.sku,
    product: transaction.product.name,
    source: transaction.sourceLocation?.name ?? "kho le",
    available: 0,
    quantity: transaction.quantity,
    customer: transaction.customerName ?? "-",
  }));
}