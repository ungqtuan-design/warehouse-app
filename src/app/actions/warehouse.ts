"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

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
  imageUrl: z.string().trim().url().optional().or(z.literal("")),
  leadTimeDays: z.coerce.number().int().min(0).max(365),
  isActive: z.boolean(),
  isObsolete: z.boolean(),
});

const userSchema = z.object({
  username: z.string().trim().min(3),
  password: z.string().min(3),
  name: z.string().trim().min(1),
  email: z.string().trim().email().optional().or(z.literal("")),
  role: z.nativeEnum(UserRole),
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

  const parsed = productSchema.parse({
    name: String(formData.get("name") ?? ""),
    supplierId: String(formData.get("supplierId") ?? ""),
    imageUrl: String(formData.get("imageUrl") ?? ""),
    leadTimeDays: formData.get("leadTimeDays") ?? "0",
    isActive: formData.get("isActive") === "on",
    isObsolete: formData.get("isObsolete") === "on",
  });

  await prisma.product.create({
    data: {
      sku: createSku(parsed.name),
      name: parsed.name,
      supplierId: parsed.supplierId,
      imageUrl: toOptionalValue(parsed.imageUrl),
      leadTimeDays: parsed.leadTimeDays,
      status: parsed.isActive ? "ACTIVE" : "INACTIVE",
      isObsolete: parsed.isObsolete,
      obsoleteAt: parsed.isObsolete ? new Date() : null,
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
    email: String(formData.get("email") ?? ""),
    role: formData.get("role") === UserRole.ADMIN ? UserRole.ADMIN : UserRole.OPERATION,
  });

  await prisma.user.create({
    data: {
      username: parsed.username,
      passwordHash: hashPassword(parsed.password),
      name: parsed.name,
      email: toOptionalValue(parsed.email),
      role: parsed.role,
    },
  });

  revalidatePath("/manage-users");
  redirect("/manage-users");
}
