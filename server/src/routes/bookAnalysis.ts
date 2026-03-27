import { Router } from "express";
import type { ApiResponse } from "@ai-novel/shared/types/api";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { bookAnalysisService } from "../services/bookAnalysis/BookAnalysisService";

const router = Router();

const providerSchema = z.enum(["deepseek", "siliconflow", "openai", "anthropic", "grok", "kimi", "glm", "qwen", "gemini"]);
const bookAnalysisStatusSchema = z.enum(["draft", "queued", "running", "succeeded", "failed", "cancelled", "archived"]);
const sectionKeySchema = z.enum([
  "overview",
  "plot_structure",
  "timeline",
  "character_system",
  "worldbuilding",
  "themes",
  "style_technique",
  "market_highlights",
]);

const analysisParamsSchema = z.object({
  id: z.string().trim().min(1),
});

const analysisSectionParamsSchema = z.object({
  id: z.string().trim().min(1),
  sectionKey: sectionKeySchema,
});

const listQuerySchema = z.object({
  keyword: z.string().trim().optional(),
  status: bookAnalysisStatusSchema.optional(),
  documentId: z.string().trim().optional(),
});

const createSchema = z.object({
  documentId: z.string().trim().min(1),
  versionId: z.string().trim().optional(),
  provider: providerSchema.optional(),
  model: z.string().trim().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(256).max(32768).optional(),
  includeTimeline: z.boolean().optional().default(false),
});

const publishSchema = z.object({
  novelId: z.string().trim().min(1),
});

const sectionUpdateSchema = z.object({
  editedContent: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  frozen: z.boolean().optional(),
}).refine(
  (value) => value.editedContent !== undefined || value.notes !== undefined || value.frozen !== undefined,
  {
    message: "至少需要提供一个字段。",
  },
);

const sectionOptimizePreviewSchema = z.object({
  currentDraft: z.string(),
  instruction: z.string().trim().min(1),
});

const statusUpdateSchema = z.object({
  status: z.enum(["archived"]),
});

const exportQuerySchema = z.object({
  format: z.enum(["markdown", "json"]).default("markdown"),
});

router.use(authMiddleware);

router.get("/", validate({ query: listQuerySchema }), async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const data = await bookAnalysisService.listAnalyses(query);
    res.status(200).json({
      success: true,
      data,
      message: "书籍分析列表已加载。",
    } satisfies ApiResponse<typeof data>);
  } catch (error) {
    next(error);
  }
});

router.post("/", validate({ body: createSchema }), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createSchema>;
    const data = await bookAnalysisService.createAnalysis(body);
    res.status(201).json({
      success: true,
      data,
      message: "书籍分析已创建。",
    } satisfies ApiResponse<typeof data>);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", validate({ params: analysisParamsSchema }), async (req, res, next) => {
  try {
    const { id } = req.params as z.infer<typeof analysisParamsSchema>;
    const data = await bookAnalysisService.getAnalysisById(id);
    if (!data) {
      res.status(404).json({
        success: false,
        error: "书籍分析不存在。",
      } satisfies ApiResponse<null>);
      return;
    }
    res.status(200).json({
      success: true,
      data,
      message: "书籍分析已加载。",
    } satisfies ApiResponse<typeof data>);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/rebuild", validate({ params: analysisParamsSchema }), async (req, res, next) => {
  try {
    const { id } = req.params as z.infer<typeof analysisParamsSchema>;
    const data = await bookAnalysisService.rebuildAnalysis(id);
    res.status(202).json({
      success: true,
      data,
      message: "书籍分析重建已排队。",
    } satisfies ApiResponse<typeof data>);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/copy", validate({ params: analysisParamsSchema }), async (req, res, next) => {
  try {
    const { id } = req.params as z.infer<typeof analysisParamsSchema>;
    const data = await bookAnalysisService.copyAnalysis(id);
    res.status(201).json({
      success: true,
      data,
      message: "书籍分析已复制。",
    } satisfies ApiResponse<typeof data>);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/:id/publish",
  validate({ params: analysisParamsSchema, body: publishSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as z.infer<typeof analysisParamsSchema>;
      const body = req.body as z.infer<typeof publishSchema>;
      const data = await bookAnalysisService.publishToNovelKnowledge(id, body.novelId);
      res.status(200).json({
        success: true,
        data,
        message: "书籍分析已发布到小说知识库。",
      } satisfies ApiResponse<typeof data>);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/:id/sections/:sectionKey/optimize-preview",
  validate({ params: analysisSectionParamsSchema, body: sectionOptimizePreviewSchema }),
  async (req, res, next) => {
    try {
      const { id, sectionKey } = req.params as z.infer<typeof analysisSectionParamsSchema>;
      const body = req.body as z.infer<typeof sectionOptimizePreviewSchema>;
      const data = await bookAnalysisService.optimizeSectionPreview(id, sectionKey, body);
      res.status(200).json({
        success: true,
        data,
        message: "书籍分析章节优化预览已生成。",
      } satisfies ApiResponse<typeof data>);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/:id/sections/:sectionKey/regenerate",
  validate({ params: analysisSectionParamsSchema }),
  async (req, res, next) => {
    try {
      const { id, sectionKey } = req.params as z.infer<typeof analysisSectionParamsSchema>;
      const data = await bookAnalysisService.regenerateSection(id, sectionKey);
      res.status(202).json({
        success: true,
        data,
        message: "书籍分析章节重新生成已排队。",
      } satisfies ApiResponse<typeof data>);
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/:id/sections/:sectionKey",
  validate({ params: analysisSectionParamsSchema, body: sectionUpdateSchema }),
  async (req, res, next) => {
    try {
      const { id, sectionKey } = req.params as z.infer<typeof analysisSectionParamsSchema>;
      const body = req.body as z.infer<typeof sectionUpdateSchema>;
      const data = await bookAnalysisService.updateSection(id, sectionKey, body);
      res.status(200).json({
        success: true,
        data,
        message: "书籍分析章节已更新。",
      } satisfies ApiResponse<typeof data>);
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/:id",
  validate({ params: analysisParamsSchema, body: statusUpdateSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as z.infer<typeof analysisParamsSchema>;
      const body = req.body as z.infer<typeof statusUpdateSchema>;
      const data = await bookAnalysisService.updateAnalysisStatus(id, body.status);
      res.status(200).json({
        success: true,
        data,
        message: "书籍分析已更新。",
      } satisfies ApiResponse<typeof data>);
    } catch (error) {
      next(error);
    }
  },
);

router.get("/:id/export", validate({ params: analysisParamsSchema, query: exportQuerySchema }), async (req, res, next) => {
  try {
    const { id } = req.params as z.infer<typeof analysisParamsSchema>;
    const query = exportQuerySchema.parse(req.query);
    const data = await bookAnalysisService.buildExportContent(id, query.format);
    res.setHeader("Content-Type", data.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(data.fileName)}"`);
    res.status(200).send(data.content);
  } catch (error) {
    next(error);
  }
});

export default router;
