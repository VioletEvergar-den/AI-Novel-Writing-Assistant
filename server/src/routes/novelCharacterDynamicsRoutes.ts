import type { Router } from "express";
import type { ApiResponse } from "@ai-novel/shared/types/api";
import { z } from "zod";
import { validate } from "../middleware/validate";
import type { NovelService } from "../services/novel/NovelService";
import {
  confirmCandidateInputSchema,
  mergeCandidateInputSchema,
  updateCharacterDynamicStateInputSchema,
  updateRelationStageInputSchema,
} from "../services/novel/dynamics/characterDynamicsSchemas";

const candidateParamsSchema = z.object({
  id: z.string().trim().min(1),
  candidateId: z.string().trim().min(1),
});

const dynamicCharacterParamsSchema = z.object({
  id: z.string().trim().min(1),
  characterId: z.string().trim().min(1),
});

const dynamicRelationParamsSchema = z.object({
  id: z.string().trim().min(1),
  relationId: z.string().trim().min(1),
});

const overviewQuerySchema = z.object({
  chapterOrder: z.coerce.number().int().min(1).optional(),
});

interface RegisterNovelCharacterDynamicsRoutesInput {
  router: Router;
  novelService: NovelService;
  idParamsSchema: z.ZodType<{ id: string }>;
}

export function registerNovelCharacterDynamicsRoutes(
  input: RegisterNovelCharacterDynamicsRoutesInput,
): void {
  const { router, novelService, idParamsSchema } = input;

  router.get(
    "/:id/character-dynamics/overview",
    validate({ params: idParamsSchema, query: overviewQuerySchema }),
    async (req, res, next) => {
      try {
        const { id } = req.params as z.infer<typeof idParamsSchema>;
        const query = overviewQuerySchema.parse(req.query);
        const data = await novelService.getCharacterDynamicsOverview(id, query);
        res.status(200).json({
          success: true,
          data,
          message: "角色动态概览已加载。",
        } satisfies ApiResponse<typeof data>);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/:id/character-candidates",
    validate({ params: idParamsSchema }),
    async (req, res, next) => {
      try {
        const { id } = req.params as z.infer<typeof idParamsSchema>;
        const data = await novelService.listCharacterCandidates(id);
        res.status(200).json({
          success: true,
          data,
          message: "角色候选列表已加载。",
        } satisfies ApiResponse<typeof data>);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/:id/character-candidates/:candidateId/confirm",
    validate({ params: candidateParamsSchema, body: confirmCandidateInputSchema }),
    async (req, res, next) => {
      try {
        const { id, candidateId } = req.params as z.infer<typeof candidateParamsSchema>;
        const data = await novelService.confirmCharacterCandidate(id, candidateId, req.body as any);
        res.status(200).json({
          success: true,
          data,
          message: "角色候选已确认。",
        } satisfies ApiResponse<typeof data>);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/:id/character-candidates/:candidateId/merge",
    validate({ params: candidateParamsSchema, body: mergeCandidateInputSchema }),
    async (req, res, next) => {
      try {
        const { id, candidateId } = req.params as z.infer<typeof candidateParamsSchema>;
        const data = await novelService.mergeCharacterCandidate(id, candidateId, req.body as any);
        res.status(200).json({
          success: true,
          data,
          message: "角色候选已合并。",
        } satisfies ApiResponse<typeof data>);
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/:id/characters/:characterId/dynamic-state",
    validate({ params: dynamicCharacterParamsSchema, body: updateCharacterDynamicStateInputSchema }),
    async (req, res, next) => {
      try {
        const { id, characterId } = req.params as z.infer<typeof dynamicCharacterParamsSchema>;
        const data = await novelService.updateCharacterDynamicState(id, characterId, req.body as any);
        res.status(200).json({
          success: true,
          data,
          message: "Character dynamic state updated.",
        } satisfies ApiResponse<typeof data>);
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/:id/character-relations/:relationId/stage",
    validate({ params: dynamicRelationParamsSchema, body: updateRelationStageInputSchema }),
    async (req, res, next) => {
      try {
        const { id, relationId } = req.params as z.infer<typeof dynamicRelationParamsSchema>;
        const data = await novelService.updateCharacterRelationStage(id, relationId, req.body as any);
        res.status(200).json({
          success: true,
          data,
          message: "角色关系阶段已更新。",
        } satisfies ApiResponse<typeof data>);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/:id/character-dynamics/rebuild",
    validate({ params: idParamsSchema }),
    async (req, res, next) => {
      try {
        const { id } = req.params as z.infer<typeof idParamsSchema>;
        const data = await novelService.rebuildCharacterDynamics(id);
        res.status(200).json({
          success: true,
          data,
          message: "角色动态已重建。",
        } satisfies ApiResponse<typeof data>);
      } catch (error) {
        next(error);
      }
    },
  );
}
