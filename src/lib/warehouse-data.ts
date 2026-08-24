import { TransactionType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type DashboardRiskLevel = "red" | "yellow" | "normal";

function getLocationName(code: "KHO_TONG" | "KHO_LE") {
  return code === "KHO_TONG" ? "Kho Tổng" : "Kho Lẻ";
}

function getRiskLevel(totalQty: number, outbound7d: number, outbound30d: number, leadTimeDays: number): DashboardRiskLevel {
  const demandPressure = outbound7d > 0 || outbound30d >= 10;
  const longLead = leadTimeDays >= 21;

  if (totalQty <= 10 || (demandPressure && totalQty <= 20) || (longLead && totalQty <= 30)) {
    return "red";
  }

  if (totalQty <= 25 || outbound30d >= 5 || leadTimeDays >= 14) {
    return "yellow";
  }

  return "normal";
}

export async function getSuppliers() {
  return prisma.supplier.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export async function getProductRows() {
  const since30d = new Date(Date.now() - THIRTY_DAYS_MS);
  const since7d = new Date(Date.now() - SEVEN_DAYS_MS);
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
            gte: since30d,
          },
        },
        select: {
          quantity: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  return products.map((product) => {
    const khoTongQty = product.inventoryBalances.find((balance) => balance.location.code === "KHO_TONG")?.quantity ?? 0;
    const khoLeQty = product.inventoryBalances.find((balance) => balance.location.code === "KHO_LE")?.quantity ?? 0;
    const outbound30d = product.inventoryTransactions.reduce((sum, transaction) => sum + transaction.quantity, 0);
    const outbound7d = product.inventoryTransactions
      .filter((transaction) => transaction.createdAt >= since7d)
      .reduce((sum, transaction) => sum + transaction.quantity, 0);

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      imageUrl: product.imageUrl,
      costPrice: Number(product.costPrice),
      leadTimeDays: product.leadTimeDays,
      supplierId: product.supplierId,
      supplierName: product.supplier.name,
      status: product.status,
      khoTongQty,
      khoLeQty,
      totalQty: khoTongQty + khoLeQty,
      outbound7d,
      outbound30d,
    };
  });
}

export async function getDashboardData() {
  const [products, inboundCount30d, customerOrders30d] = await Promise.all([
    getProductRows(),
    prisma.inventoryTransaction.count({
      where: {
        type: TransactionType.MANUFACTURER_IN,
        createdAt: {
          gte: new Date(Date.now() - THIRTY_DAYS_MS),
        },
      },
    }),
    prisma.inventoryTransaction.count({
      where: {
        type: TransactionType.CUSTOMER_OUT,
        createdAt: {
          gte: new Date(Date.now() - THIRTY_DAYS_MS),
        },
      },
    }),
  ]);

  const watchRows = products
    .map((product) => {
      const riskLevel = getRiskLevel(product.totalQty, product.outbound7d, product.outbound30d, product.leadTimeDays);

      return {
        ...product,
        riskLevel,
      };
    })
    .sort((left, right) => {
      if (left.riskLevel !== right.riskLevel) {
        const weight = { red: 0, yellow: 1, normal: 2 };

        return weight[left.riskLevel] - weight[right.riskLevel];
      }

      if (left.totalQty !== right.totalQty) {
        return left.totalQty - right.totalQty;
      }

      if (left.outbound30d !== right.outbound30d) {
        return right.outbound30d - left.outbound30d;
      }

      return right.leadTimeDays - left.leadTimeDays;
    });

  const totalStockUnits = products.reduce((sum, product) => sum + product.totalQty, 0);
  const lowStockCount = watchRows.filter((row) => row.riskLevel !== "normal").length;

  return {
    metrics: {
      totalProducts: products.length,
      totalStockUnits,
      lowStockCount,
      inboundCount30d,
      customerOrders30d,
    },
    watchRows,
  };
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
    note: transaction.note ?? "-",
    createdAt: transaction.createdAt.toLocaleString("sv-SE"),
  }));
}

export async function getInboundProductOptions() {
  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
    },
    include: {
      supplier: true,
    },
    orderBy: [{ name: "asc" }],
  });

  return products.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    supplierName: product.supplier.name,
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
    source: transaction.sourceLocation?.name ?? "Kho Lẻ",
    quantity: transaction.quantity,
    note: transaction.note ?? "-",
    createdAt: transaction.createdAt.toLocaleString("sv-SE"),
  }));
}

export async function getSupplierExportRows() {
  const suppliers = await getSuppliers();

  return suppliers.map((supplier) => ({
    supplier_name: supplier.name,
    contact_name: supplier.contactName ?? "",
    email: supplier.email ?? "",
    phone: supplier.phone ?? "",
    address: supplier.address ?? "",
    payment_terms: supplier.paymentTerms ?? "",
    delivery_method: supplier.deliveryMethod ?? "",
    past_issues: supplier.pastIssues ?? "",
    status: supplier.isActive ? "ACTIVE" : "INACTIVE",
  }));
}

export async function getStockExportRows() {
  const products = await getProductRows();

  return products.map((product) => ({
    sku: product.sku,
    product_name: product.name,
    supplier_name: product.supplierName,
    kho_tong: product.khoTongQty,
    kho_le: product.khoLeQty,
    total_stock: product.totalQty,
    lead_time_days: product.leadTimeDays,
    status: product.status,
  }));
}

export async function getOrderExportRows() {
  const transactions = await prisma.inventoryTransaction.findMany({
    include: {
      product: {
        include: {
          supplier: true,
        },
      },
      sourceLocation: true,
      destinationLocation: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return transactions.map((transaction) => ({
    created_at: transaction.createdAt.toISOString(),
    type: transaction.type,
    sku: transaction.product.sku,
    product_name: transaction.product.name,
    supplier_name: transaction.product.supplier.name,
    quantity: transaction.quantity,
    source_location: transaction.sourceLocation?.name ?? "",
    destination_location: transaction.destinationLocation?.name ?? "",
    reference_no: transaction.referenceNo ?? "",
    note: transaction.note ?? "",
  }));
}

export async function getInventoryExportRows() {
  const { watchRows } = await getDashboardData();

  return watchRows.map((row) => ({
    sku: row.sku,
    product_name: row.name,
    supplier_name: row.supplierName,
    kho_tong: row.khoTongQty,
    kho_le: row.khoLeQty,
    total_stock: row.totalQty,
    outbound_7d: row.outbound7d,
    outbound_30d: row.outbound30d,
    lead_time_days: row.leadTimeDays,
    risk_level: row.riskLevel.toUpperCase(),
    kho_tong_name: getLocationName("KHO_TONG"),
    kho_le_name: getLocationName("KHO_LE"),
  }));
}