import { documentsStorageService } from "./storage.js";
import { searchService } from "./search.js";
import { prisma } from "../config/prisma.js";
import ExcelJS from "exceljs";

export const documentsService = {
  async search(opts: {
    query?: string;
    companyCode?: string;
    department?: string;
    site?: string;
    page: number;
    limit: number;
  }) {
    if (searchService.isConfigured()) {
      return searchService.search(opts);
    }
    // Fallback to DB when search index not configured
    const where: Record<string, unknown> = {};
    if (opts.companyCode) where.companyCode = opts.companyCode;
    if (opts.department) where.department = opts.department;
    if (opts.site) where.site = opts.site;
    const skip = (opts.page - 1) * opts.limit;
    const [items, total] = await Promise.all([
      prisma.document.findMany({ where, skip, take: opts.limit, orderBy: { createdAt: "desc" } }),
      prisma.document.count({ where }),
    ]);
    return { items, total, page: opts.page, limit: opts.limit };
  },

  async getById(id: string) {
    return prisma.document.findUnique({ where: { id } });
  },

  async getDownloadUrl(id: string) {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) throw new Error("Document not found");
    const url = await documentsStorageService.getSignedUrl(doc.blobPath);
    return { url, filename: doc.filename };
  },

  async createShareLink(id: string, expiresInDays: number) {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) throw new Error("Document not found");
    const url = await documentsStorageService.getAnonymousShareUrl(doc.blobPath, expiresInDays);
    return url;
  },

  async upload(opts: {
    file: Express.Multer.File;
    companyCode: string;
    productName?: string;
    department?: string;
    site?: string;
    tags?: string[];
  }) {
    const blobPath = await documentsStorageService.upload(opts.file, opts.companyCode);
    const doc = await prisma.document.create({
      data: {
        companyCode: opts.companyCode,
        filename: opts.file.originalname,
        blobPath,
        productName: opts.productName,
        department: opts.department,
        site: opts.site,
        tags: JSON.stringify(opts.tags ?? []),
      },
    });
    if (searchService.isConfigured()) await searchService.indexDocument(doc);
    return doc;
  },

  async bulkUpload(files: Express.Multer.File[], companyCode: string) {
    const results = { uploaded: 0, failed: 0, errors: [] as string[] };
    for (const file of files) {
      try {
        await this.upload({ file, companyCode });
        results.uploaded++;
      } catch (e) {
        results.failed++;
        results.errors.push(`${file.originalname}: ${(e as Error).message}`);
      }
    }
    return results;
  },

  async updateMetadata(id: string, data: Record<string, unknown>) {
    const allowed = ["productName", "department", "site", "tags"];
    const update: Record<string, unknown> = {};
    for (const k of allowed) if (data[k] !== undefined) update[k] = k === "tags" ? JSON.stringify(data[k]) : data[k];
    const doc = await prisma.document.update({ where: { id }, data: update });
    if (searchService.isConfigured()) await searchService.indexDocument(doc);
    return doc;
  },

  async bulkUpdateMetadata(ids: string[], metadata: Record<string, unknown>) {
    const allowed = ["productName", "department", "site", "tags"];
    const update: Record<string, unknown> = {};
    for (const k of allowed) if (metadata[k] !== undefined) update[k] = k === "tags" ? JSON.stringify(metadata[k]) : metadata[k];
    const result = await prisma.document.updateMany({ where: { id: { in: ids } }, data: update });
    const docs = await prisma.document.findMany({ where: { id: { in: ids } } });
    if (searchService.isConfigured()) for (const d of docs) await searchService.indexDocument(d);
    return { count: result.count };
  },

  async exportToExcel(ids?: string[]) {
    const docs = ids?.length
      ? await prisma.document.findMany({ where: { id: { in: ids } } })
      : await prisma.document.findMany();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Documents");
    ws.columns = [
      { header: "Id", key: "id", width: 36 },
      { header: "CompanyCode", key: "companyCode", width: 14 },
      { header: "Filename", key: "filename", width: 40 },
      { header: "ProductName", key: "productName", width: 30 },
      { header: "Department", key: "department", width: 18 },
      { header: "Site", key: "site", width: 18 },
      { header: "Tags", key: "tags", width: 30 },
    ];
    ws.addRows(docs.map((d) => ({ ...d, tags: (JSON.parse(d.tags ?? "[]") as string[]).join(", ") })));
    const buffer = (await wb.xlsx.writeBuffer()) as Buffer;
    return buffer;
  },

  async importFromExcel(buffer: Buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new Error("No worksheet found");
    const rows = ws.getRows(2, ws.rowCount ?? 0) ?? [];
    let updated = 0;
    for (const row of rows) {
      const id = row.getCell(1).value?.toString();
      if (!id) continue;
      const companyCode = row.getCell(2).value?.toString();
      const filename = row.getCell(3).value?.toString();
      const productName = row.getCell(4).value?.toString();
      const department = row.getCell(5).value?.toString();
      const site = row.getCell(6).value?.toString();
      const tagsStr = row.getCell(7).value?.toString();
      const tags = tagsStr ? tagsStr.split(",").map((s) => s.trim()) : [];
      await prisma.document.updateMany({
        where: { id },
        data: {
          ...(companyCode && { companyCode }),
          ...(filename && { filename }),
          ...(productName !== undefined && { productName }),
          ...(department !== undefined && { department }),
          ...(site !== undefined && { site }),
          ...(tags.length >= 0 && { tags: JSON.stringify(tags) }),
        },
      });
      updated++;
    }
    return { updated };
  },

  async getLabelData(id: string) {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return null;
    return {
      productName: doc.productName ?? doc.filename,
      companyCode: doc.companyCode,
      department: doc.department,
      site: doc.site,
      filename: doc.filename,
    };
  },
};
