import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { protectedProcedure, router } from "../_core/trpc";

/**
 * Supplier settings — admin-editable pricing configuration.
 * Lets Oestergaard adjust distribution discounts, default margins, and
 * pricing models per supplier without code changes.
 */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

const pricingModelEnum = z.enum([
  "net_price",
  "list_minus_distribution",
  "as_is",
  "list_minus_stated_discount",
  "footer_based",
]);

export const suppliersRouter = router({
  list: protectedProcedure.query(() => db.listSuppliers()),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        pricingModel: pricingModelEnum.optional(),
        defaultDiscountPct: z.number().min(0).max(99.999).nullable().optional(),
        defaultMarginPct: z.number().min(0).max(99.999).nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const existing = await db.getSupplierById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await db.updateSupplier(input.id, {
        pricingModel: input.pricingModel ?? undefined,
        defaultDiscountPct:
          input.defaultDiscountPct === undefined
            ? undefined
            : input.defaultDiscountPct === null
              ? null
              : input.defaultDiscountPct.toString(),
        defaultMarginPct:
          input.defaultMarginPct === undefined
            ? undefined
            : input.defaultMarginPct === null
              ? null
              : input.defaultMarginPct.toString(),
        notes: input.notes === undefined ? undefined : input.notes,
      });
      return { success: true };
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(128),
        pricingModel: pricingModelEnum,
        defaultDiscountPct: z.number().min(0).max(99.999).nullable().optional(),
        defaultMarginPct: z.number().min(0).max(99.999).nullable().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const existing = await db.getSupplierByName(input.name);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "A supplier with this name already exists" });
      }
      const id = await db.createSupplier({
        name: input.name,
        pricingModel: input.pricingModel,
        defaultDiscountPct: input.defaultDiscountPct?.toString(),
        defaultMarginPct: input.defaultMarginPct?.toString(),
        notes: input.notes,
      });
      return { id };
    }),
});
