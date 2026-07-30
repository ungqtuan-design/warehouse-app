"use server";

import { LocationCode, Prisma } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { resizeUploadedImage } from "@/lib/image";
import { requireAdmin, requireUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const supplierSchema = z.object({
  name: z.string().trim().min(1),
  contactName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  address: z.string().trim().optional(),
  isActive: z.boolean(),
});

const productSchema = z.object({
  name: z.string().trim().min(1),
  supplierId: z.string().trim().min(1),
  leadTimeDays: z.coerce.number().int().min(0).max(365),
  isActive: z.boolean(),
});

const userSchema = z.object({
  username: z.string().trim().min(3),
  password: z.string().min(3),
  name: z.string().trim().min(1),
  role: z.nativeEnum(UserRole),
});

const resetPasswordSchema = z.object({
  userId: z.string().trim().min(1),
  password: z.string().min(3),
});

const updateSupplierSchema = supplierSchema.extend({
  supplierId: z.string().trim().min(1),
});

const inboundLineSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1),
  note: z.string().trim().optional(),
});

const inboundBatchSchema = z.object({
  referenceNo: z.string().trim().optional(),
  lines: z.array(inboundLineSchema).min(1),
});

function toOptionalValue(value: string | undefined) {
  if (!value) {
    return null;
  }

  return value;
}

function createSku(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toUpperCase()
    .slice(0, 12) || "ITEM";

  return `${base}-${Date.now().toString(36).toUpperCase()}`;
}

export async function createSupplierAction(formData: FormData) {
  await requireUser();

  const parsed = supplierSchema.parse({
    name: String(formData.get("name") ?? ""),
    contactName: String(formData.get("contactName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    address: String(formData.get("address") ?? ""),
    isActive: formData.get("isActive") === "on",
  });

  await prisma.supplier.create({
    data: {
      name: parsed.name,
      contactName: toOptionalValue(parsed.contactName),
      phone: toOptionalValue(parsed.phone),
      email: toOptionalValue(parsed.email),
      address: toOptionalValue(parsed.address),
      isActive: parsed.isActive,
    },
  });

  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function createProductAction(formData: FormData) {
  await requireUser();

  const imageEntry = formData.get("imageFile");
  let imageDataUrl: string | null = null;

  if (imageEntry instanceof File && imageEntry.size > 0) {
    if (!imageEntry.type.startsWith("image/")) {
      redirect("/products?error=invalid-image");
    }

    imageDataUrl = await resizeUploadedImage(imageEntry);
  }

  const parsed = productSchema.parse({
    name: String(formData.get("name") ?? ""),
    supplierId: String(formData.get("supplierId") ?? ""),
    leadTimeDays: formData.get("leadTimeDays") ?? "0",
    isActive: formData.get("isActive") === "on",
  });

  await prisma.product.create({
    data: {
      sku: createSku(parsed.name),
      name: parsed.name,
      supplierId: parsed.supplierId,
      imageUrl: imageDataUrl,
      leadTimeDays: parsed.leadTimeDays,
      status: parsed.isActive ? "ACTIVE" : "INACTIVE",
    },
  });

  revalidatePath("/products");
  redirect("/products");
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();

  const parsed = userSchema.parse({
    username: String(formData.get("username") ?? "").toLowerCase(),
    password: String(formData.get("password") ?? ""),
    name: String(formData.get("name") ?? ""),
    role: formData.get("role") === UserRole.ADMIN ? UserRole.ADMIN : UserRole.OPERATION,
  });

  const existingUser = await prisma.user.findUnique({
    where: {
      username: parsed.username,
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    redirect("/manage-users?error=username-taken");
  }

  try {
    await prisma.user.create({
      data: {
        username: parsed.username,
        passwordHash: hashPassword(parsed.password),
        name: parsed.name,
        role: parsed.role,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/manage-users?error=username-taken");
    }

    throw error;
  }

  revalidatePath("/manage-users");
  redirect("/manage-users");
}

export async function updateSupplierAction(formData: FormData) {
  await requireUser();

  const parsed = updateSupplierSchema.parse({
    supplierId: String(formData.get("supplierId") ?? ""),
    name: String(formData.get("name") ?? ""),
    contactName: String(formData.get("contactName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    address: String(formData.get("address") ?? ""),
    isActive: formData.get("isActive") === "on",
  });

  await prisma.supplier.update({
    where: {
      id: parsed.supplierId,
    },
    data: {
      name: parsed.name,
      contactName: toOptionalValue(parsed.contactName),
      phone: toOptionalValue(parsed.phone),
      email: toOptionalValue(parsed.email),
      address: toOptionalValue(parsed.address),
      isActive: parsed.isActive,
    },
  });

  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function createInboundBatchAction(formData: FormData) {
  const user = await requireUser();

  let rawLines: unknown = [];

  try {
    rawLines = JSON.parse(String(formData.get("linesJson") ?? "[]"));
  } catch {
    redirect("/inbound?error=invalid-lines");
  }

  const parsed = inboundBatchSchema.parse({
    referenceNo: String(formData.get("referenceNo") ?? ""),
    lines: rawLines,
  });

  const khoTong = await prisma.location.findUnique({
    where: {
      code: LocationCode.KHO_TONG,
    },
    select: {
      id: true,
    },
  });

  if (!khoTong) {
    redirect("/inbound?error=missing-kho-tong");
  }

  await prisma.$transaction(async (tx) => {
    for (const line of parsed.lines) {
      const note = toOptionalValue(line.note);
      const referenceNo = toOptionalValue(parsed.referenceNo);

      await tx.inventoryTransaction.create({
        data: {
          type: "MANUFACTURER_IN",
          productId: line.productId,
          quantity: line.quantity,
          referenceNo,
          note,
          destinationLocationId: khoTong.id,
          createdById: user.id,
        },
      });

      await tx.inventoryBalance.upsert({
        where: {
          productId_locationId: {
            productId: line.productId,
            locationId: khoTong.id,
          },
        },
        update: {
          quantity: {
            increment: line.quantity,
          },
        },
        create: {
          productId: line.productId,
          locationId: khoTong.id,
          quantity: line.quantity,
        },
      });
    }
  });

  revalidatePath("/inbound");
  revalidatePath("/inventory");
  revalidatePath("/");
  redirect("/inbound");
}

export async function resetUserPasswordAction(formData: FormData) {
  await requireAdmin();

  const parsed = resetPasswordSchema.parse({
    userId: String(formData.get("userId") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  await prisma.user.update({
    where: {
      id: parsed.userId,
    },
    data: {
      passwordHash: hashPassword(parsed.password),
      sessions: {
        deleteMany: {},
      },
    },
  });

  revalidatePath("/manage-users");
  redirect("/manage-users?passwordReset=1");
}
