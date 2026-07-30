"use server";

import { LocationCode, Prisma } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { FormActionState } from "@/lib/action-state";
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

const updateProductSchema = productSchema.extend({
  productId: z.string().trim().min(1),
});

const userSchema = z.object({
  username: z.string().trim().min(3),
  password: z.string().min(3),
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
  lines: z.array(inboundLineSchema).min(1),
});

const outboundLineSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1),
  warehouse: z.enum([LocationCode.KHO_TONG, LocationCode.KHO_LE]),
  note: z.string().trim().optional(),
});

const outboundBatchSchema = z.object({
  lines: z.array(outboundLineSchema).min(1),
});

type ProductUpdateInlineState = {
  status: "idle" | "success" | "error";
  message: string;
};

type BasketSubmitState = FormActionState;

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

export async function createSupplierAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireUser();

  try {
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
  } catch {
    return {
      status: "error",
      message: "supplier-create-failed",
    };
  }

  revalidatePath("/suppliers");

  return {
    status: "success",
    message: "supplier-created",
  };
}

export async function createProductAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireUser();

  const imageEntry = formData.get("imageFile");
  let imageDataUrl: string | null = null;

  if (imageEntry instanceof File && imageEntry.size > 0) {
    if (!imageEntry.type.startsWith("image/")) {
      return {
        status: "error",
        message: "invalid-image",
      };
    }

    imageDataUrl = await resizeUploadedImage(imageEntry);
  }

  try {
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
  } catch {
    return {
      status: "error",
      message: "product-create-failed",
    };
  }

  revalidatePath("/products");

  return {
    status: "success",
    message: "product-created",
  };
}

export async function updateProductInlineAction(
  _previousState: ProductUpdateInlineState,
  formData: FormData,
): Promise<ProductUpdateInlineState> {
  await requireUser();

  const imageEntry = formData.get("imageFile");
  let imageDataUrl: string | null | undefined;

  if (imageEntry instanceof File && imageEntry.size > 0) {
    if (!imageEntry.type.startsWith("image/")) {
      return {
        status: "error" as const,
        message: "Invalid image file.",
      };
    }

    imageDataUrl = await resizeUploadedImage(imageEntry);
  }

  try {
    const parsed = updateProductSchema.parse({
      productId: String(formData.get("productId") ?? ""),
      name: String(formData.get("name") ?? ""),
      supplierId: String(formData.get("supplierId") ?? ""),
      leadTimeDays: formData.get("leadTimeDays") ?? "0",
      isActive: formData.get("isActive") === "on",
    });

    await prisma.product.update({
      where: {
        id: parsed.productId,
      },
      data: {
        name: parsed.name,
        supplierId: parsed.supplierId,
        leadTimeDays: parsed.leadTimeDays,
        status: parsed.isActive ? "ACTIVE" : "INACTIVE",
        ...(imageDataUrl === undefined ? {} : { imageUrl: imageDataUrl }),
      },
    });
  } catch {
    return {
      status: "error" as const,
      message: "Unable to update product.",
    };
  }

  revalidatePath("/products");

  return {
    status: "success" as const,
    message: "Product updated successfully.",
  };
}

export async function createUserAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireAdmin();

  const parsed = userSchema.parse({
    username: String(formData.get("username") ?? "").toLowerCase(),
    password: String(formData.get("password") ?? ""),
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
    return {
      status: "error",
      message: "username-taken",
    };
  }

  try {
    await prisma.user.create({
      data: {
        username: parsed.username,
        passwordHash: hashPassword(parsed.password),
        role: parsed.role,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: "username-taken",
      };
    }

    return {
      status: "error",
      message: "user-create-failed",
    };
  }

  revalidatePath("/manage-users");

  return {
    status: "success",
    message: "user-created",
  };
}

export async function updateSupplierAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireUser();

  try {
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
  } catch {
    return {
      status: "error",
      message: "supplier-update-failed",
    };
  }

  revalidatePath("/suppliers");

  return {
    status: "success",
    message: "supplier-updated",
  };
}

export async function createInboundBatchAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();

  let rawLines: unknown = [];

  try {
    rawLines = JSON.parse(String(formData.get("linesJson") ?? "[]"));
  } catch {
    return {
      status: "error",
      message: "invalid-lines",
    };
  }

  let parsed: z.infer<typeof inboundBatchSchema>;

  try {
    parsed = inboundBatchSchema.parse({
      lines: rawLines,
    });
  } catch {
    return {
      status: "error",
      message: "invalid-lines",
    };
  }

  const khoTong = await prisma.location.findUnique({
    where: {
      code: LocationCode.KHO_TONG,
    },
    select: {
      id: true,
    },
  });

  if (!khoTong) {
    return {
      status: "error",
      message: "missing-kho-tong",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const line of parsed.lines) {
        const note = toOptionalValue(line.note);

        await tx.inventoryTransaction.create({
          data: {
            type: "MANUFACTURER_IN",
            productId: line.productId,
            quantity: line.quantity,
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
  } catch {
    return {
      status: "error",
      message: "inbound-submit-failed",
    };
  }

  revalidatePath("/inbound");
  revalidatePath("/inventory");
  revalidatePath("/");

  return {
    status: "success",
    message: "inbound-created",
  };
}

export async function submitBasketAction(
  _previousState: BasketSubmitState,
  formData: FormData,
): Promise<BasketSubmitState> {
  const user = await requireUser();

  let rawLines: unknown = [];

  try {
    rawLines = JSON.parse(String(formData.get("linesJson") ?? "[]"));
  } catch {
    return {
      status: "error",
      message: "Invalid basket payload.",
    };
  }

  let parsed: z.infer<typeof outboundBatchSchema>;

  try {
    parsed = outboundBatchSchema.parse({
      lines: rawLines,
    });
  } catch {
    return {
      status: "error",
      message: "Please complete basket information.",
    };
  }

  const locations = await prisma.location.findMany({
    where: {
      code: {
        in: [LocationCode.KHO_TONG, LocationCode.KHO_LE],
      },
    },
    select: {
      id: true,
      code: true,
    },
  });

  const locationMap = new Map(locations.map((location) => [location.code, location.id]));

  if (!locationMap.has(LocationCode.KHO_TONG) || !locationMap.has(LocationCode.KHO_LE)) {
    return {
      status: "error",
      message: "Warehouse locations are not initialized.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const line of parsed.lines) {
        const locationId = locationMap.get(line.warehouse);
        const khoLeLocationId = locationMap.get(LocationCode.KHO_LE);

        if (!locationId || !khoLeLocationId) {
          throw new Error("missing-location");
        }

        const balance = await tx.inventoryBalance.findUnique({
          where: {
            productId_locationId: {
              productId: line.productId,
              locationId,
            },
          },
          select: {
            quantity: true,
          },
        });

        if (!balance || balance.quantity < line.quantity) {
          throw new Error("insufficient-stock");
        }

        await tx.inventoryBalance.update({
          where: {
            productId_locationId: {
              productId: line.productId,
              locationId,
            },
          },
          data: {
            quantity: {
              decrement: line.quantity,
            },
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            type: line.warehouse === LocationCode.KHO_TONG ? "TRANSFER" : "CUSTOMER_OUT",
            productId: line.productId,
            quantity: line.quantity,
            note: toOptionalValue(line.note),
            sourceLocationId: locationId,
            ...(line.warehouse === LocationCode.KHO_TONG ? { destinationLocationId: khoLeLocationId } : {}),
            createdById: user.id,
          },
        });

        if (line.warehouse === LocationCode.KHO_TONG) {
          await tx.inventoryBalance.upsert({
            where: {
              productId_locationId: {
                productId: line.productId,
                locationId: khoLeLocationId,
              },
            },
            update: {
              quantity: {
                increment: line.quantity,
              },
            },
            create: {
              productId: line.productId,
              locationId: khoLeLocationId,
              quantity: line.quantity,
            },
          });
        }
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "insufficient-stock") {
      return {
        status: "error",
        message: "One or more basket items exceed available stock.",
      };
    }

    return {
      status: "error",
      message: "Unable to submit basket.",
    };
  }

  revalidatePath("/basket");
  revalidatePath("/inventory");
  revalidatePath("/products");
  revalidatePath("/");

  return {
    status: "success",
    message: "Basket submitted successfully.",
  };
}

export async function resetUserPasswordAction(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireAdmin();

  try {
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
  } catch {
    return {
      status: "error",
      message: "password-reset-failed",
    };
  }

  revalidatePath("/manage-users");

  return {
    status: "success",
    message: "password-reset",
  };
}
