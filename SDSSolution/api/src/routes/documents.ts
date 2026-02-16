import { Router } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { documentsService } from "../services/documents.js";

function mapDoc(d: { tags?: string } & Record<string, unknown>) {
  const { tags, ...rest } = d;
  return { ...rest, tags: typeof tags === "string" ? JSON.parse(tags || "[]") : tags ?? [] };
}

export const documentsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

documentsRouter.use(requireAuth);

// GET /api/documents - search documents (metadata + full text)
documentsRouter.get("/", async (req, res, next) => {
  try {
    const { q, companyCode, department, site, page = 1, limit = 20 } = req.query;
    const result = await documentsService.search({
      query: q as string,
      companyCode: companyCode as string,
      department: department as string,
      site: site as string,
      page: Number(page),
      limit: Number(limit),
    });
    res.json({ ...result, items: (result.items as Record<string, unknown>[]).map(mapDoc) });
  } catch (e) {
    next(e);
  }
});

// GET /api/documents/:id - get document metadata
documentsRouter.get("/:id", async (req, res, next) => {
  try {
    const doc = await documentsService.getById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    res.json(mapDoc(doc));
  } catch (e) {
    next(e);
  }
});

// GET /api/documents/:id/download - download document
documentsRouter.get("/:id/download", async (req, res, next) => {
  try {
    const { url, filename } = await documentsService.getDownloadUrl(req.params.id);
    res.json({ url, filename });
  } catch (e) {
    next(e);
  }
});

// GET /api/documents/:id/share - create anonymous share link
documentsRouter.post("/:id/share", async (req, res, next) => {
  try {
    const { expiresInDays = 7 } = req.body ?? {};
    const shareUrl = await documentsService.createShareLink(req.params.id, expiresInDays);
    res.json({ shareUrl });
  } catch (e) {
    next(e);
  }
});

// POST /api/documents - upload document (Edit role)
documentsRouter.post("/", requireRole("Admin", "DocumentEditor"), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const { companyCode, productName, department, site, tags } = req.body ?? {};
    const doc = await documentsService.upload({
      file: req.file,
      companyCode: companyCode ?? "default",
      productName,
      department,
      site,
      tags: tags ? JSON.parse(tags) : [],
    });
    res.status(201).json(mapDoc(doc));
  } catch (e) {
    next(e);
  }
});

// POST /api/documents/bulk - bulk upload (Admin)
documentsRouter.post("/bulk", requireRole("Admin"), upload.array("files", 100), async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[]) ?? [];
    const { companyCode } = req.body ?? {};
    const result = await documentsService.bulkUpload(files, companyCode ?? "default");
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
});

// PATCH /api/documents/:id - update metadata
documentsRouter.patch("/:id", requireRole("Admin", "DocumentEditor"), async (req, res, next) => {
  try {
    const doc = await documentsService.updateMetadata(req.params.id, req.body);
    res.json(mapDoc(doc));
  } catch (e) {
    next(e);
  }
});

// PATCH /api/documents/bulk - bulk update metadata (Admin)
documentsRouter.patch("/bulk", requireRole("Admin"), async (req, res, next) => {
  try {
    const { ids, metadata } = req.body ?? {};
    const result = await documentsService.bulkUpdateMetadata(ids ?? [], metadata ?? {});
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// POST /api/documents/export-excel - export metadata for spreadsheet view
documentsRouter.post("/export-excel", async (req, res, next) => {
  try {
    const { ids } = req.body ?? {};
    const buffer = await documentsService.exportToExcel(ids);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=documents-metadata.xlsx");
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

// POST /api/documents/import-excel - import metadata from spreadsheet
documentsRouter.post("/import-excel", requireRole("Admin", "DocumentEditor"), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const result = await documentsService.importFromExcel(req.file.buffer);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// GET /api/documents/:id/label - get label data for printing
documentsRouter.get("/:id/label", async (req, res, next) => {
  try {
    const label = await documentsService.getLabelData(req.params.id);
    if (!label) return res.status(404).json({ error: "Document not found" });
    res.json(label);
  } catch (e) {
    next(e);
  }
});
