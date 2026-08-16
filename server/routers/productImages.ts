import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { productImages } from "../../drizzle/schema";
import { eq, like } from "drizzle-orm";
import { storagePut } from "../storage";

// Fuzzy match: check if any tag or model/name matches the search term
function fuzzyMatch(image: any, searchTerms: string[]): number {
  let score = 0;
  const tags = (image.tags || "").toLowerCase().split(",").map((t: string) => t.trim());
  const model = (image.productModel || "").toLowerCase();
  const name = (image.productName || "").toLowerCase();

  for (const term of searchTerms) {
    const t = term.toLowerCase().trim();
    if (model.includes(t)) score += 3;
    if (name.includes(t)) score += 2;
    if (tags.some((tag: string) => tag.includes(t) || t.includes(tag))) score += 1;
  }
  return score;
}

export const productImagesRouter = router({
  // List all product images (admin)
  list: protectedProcedure
    .input(z.object({ supplierId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      if (input?.supplierId) {
        return (await getDb())!.select().from(productImages).where(eq(productImages.supplierId, input.supplierId));
      }
      return (await getDb())!.select().from(productImages);
    }),

  // Upload a product image (admin)
  upload: adminProcedure
    .input(z.object({
      supplierId: z.number(),
      supplierName: z.string(),
      productModel: z.string(),
      productName: z.string().optional(),
      tags: z.string().optional(),
      fileBase64: z.string(),
      fileName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const key = `product-images/${input.supplierName.toLowerCase().replace(/\s+/g, "-")}/${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, "image/png");

      const [inserted] = await (await getDb())!.insert(productImages).values({
        supplierId: input.supplierId,
        supplierName: input.supplierName,
        productModel: input.productModel,
        productName: input.productName || null,
        imageUrl: url,
        imageKey: key,
        sourceType: "manual",
        tags: input.tags || null,
      });

      return { id: (inserted as any).insertId, url };
    }),

  // Match product image by supplier + product description/model
  match: protectedProcedure
    .input(z.object({
      supplierName: z.string(),
      productDescription: z.string(),
      productModel: z.string().optional(),
    }))
    .query(async ({ input }) => {
      // Get all images for this supplier
      const allImages = await (await getDb())!.select().from(productImages)
        .where(like(productImages.supplierName, `%${input.supplierName}%`));

      if (allImages.length === 0) return { matched: false, image: null, source: "none" };

      // Build search terms from product description and model
      const searchTerms = [
        ...(input.productModel ? [input.productModel] : []),
        ...input.productDescription.split(/[\s,;]+/).filter(w => w.length > 3),
      ];

      // Score each image
      const scored = allImages.map((img: any) => ({
        ...img,
        matchScore: fuzzyMatch(img, searchTerms),
      })).filter((img: any) => img.matchScore > 0)
        .sort((a: any, b: any) => b.matchScore - a.matchScore);

      if (scored.length > 0) {
        return { matched: true, image: scored[0], source: scored[0].sourceType };
      }

      return { matched: false, image: null, source: "none" };
    }),

  // Scrape a supplier website for product images (admin, manual trigger)
  scrape: adminProcedure
    .input(z.object({
      supplierName: z.string(),
      catalogueUrl: z.string().url(),
      supplierId: z.number(),
    }))
    .mutation(async ({ input }) => {
      // Fetch the catalogue page
      const response = await fetch(input.catalogueUrl);
      if (!response.ok) {
        return { success: false, error: `Failed to fetch: ${response.status}`, imagesFound: 0 };
      }
      const html = await response.text();

      // Extract image URLs from the page (simple regex for img tags)
      const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?/gi;
      const images: Array<{ url: string; alt: string }> = [];
      let match;
      while ((match = imgRegex.exec(html)) !== null) {
        const imgUrl = match[1];
        const alt = match[2] || "";
        // Filter: only keep product-looking images (skip icons, logos, tiny images)
        if (imgUrl && !imgUrl.includes("logo") && !imgUrl.includes("icon") && !imgUrl.includes("favicon")) {
          // Resolve relative URLs
          const fullUrl = imgUrl.startsWith("http") ? imgUrl : new URL(imgUrl, input.catalogueUrl).href;
          images.push({ url: fullUrl, alt });
        }
      }

      // Store found images as scraped entries
      let inserted = 0;
      for (const img of images.slice(0, 20)) { // Limit to 20 per scrape
        const model = img.alt || `scraped-${Date.now()}`;
        await (await getDb())!.insert(productImages).values({
          supplierId: input.supplierId,
          supplierName: input.supplierName,
          productModel: model,
          productName: img.alt || null,
          imageUrl: img.url,
          imageKey: null,
          sourceType: "scraped",
          sourceUrl: input.catalogueUrl,
          tags: img.alt ? img.alt.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).join(",") : null,
        });
        inserted++;
      }

      return { success: true, imagesFound: images.length, imagesStored: inserted };
    }),
});
