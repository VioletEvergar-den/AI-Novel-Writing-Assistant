import { Router } from "express";
import type { ApiResponse } from "@ai-novel/shared/types/api";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { webDAVSyncService } from "../services/sync/WebDAVSyncService";

const router = Router();

const webDAVConfigSchema = z.object({
  serverUrl: z.string().url("服务器地址必须是有效的 URL。"),
  username: z.string().trim().min(1, "用户名不能为空。"),
  password: z.string().min(1, "密码不能为空。"),
  remotePath: z.string().trim().min(1, "远程路径不能为空。"),
  autoSyncEnabled: z.boolean().default(false),
  syncIntervalMinutes: z.coerce.number().int().min(1).max(1440).default(30),
  syncOnStartup: z.boolean().default(false),
});

const testConnectionSchema = z.object({
  serverUrl: z.string().url("服务器地址必须是有效的 URL。"),
  username: z.string().trim().min(1, "用户名不能为空。"),
  password: z.string().min(1, "密码不能为空。"),
  remotePath: z.string().trim().min(1, "远程路径不能为空。"),
});

const syncDirectionSchema = z.object({
  direction: z.enum(["upload", "download", "auto"]).optional(),
});

router.use(authMiddleware);

router.get("/config", async (_req, res, next) => {
  try {
    const config = await webDAVSyncService.getConfig();
    const data = config
      ? {
          ...config,
          password: "******",
          isConfigured: true,
        }
      : {
          serverUrl: "",
          username: "",
          password: "",
          remotePath: "/ai-novel-assistant",
          autoSyncEnabled: false,
          syncIntervalMinutes: 30,
          syncOnStartup: false,
          isConfigured: false,
        };
    res.status(200).json({
      success: true,
      data,
      message: "获取 WebDAV 配置成功。",
    } satisfies ApiResponse<typeof data>);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/config",
  validate({ body: webDAVConfigSchema }),
  async (req, res, next) => {
    try {
      const config = req.body as z.infer<typeof webDAVConfigSchema>;
      await webDAVSyncService.saveConfig(config);
      
      if (config.autoSyncEnabled) {
        webDAVSyncService.startAutoSync();
      } else {
        webDAVSyncService.stopAutoSync();
      }
      
      const data = {
        ...config,
        password: "******",
        isConfigured: true,
      };
      res.status(200).json({
        success: true,
        data,
        message: "WebDAV 配置已保存。",
      } satisfies ApiResponse<typeof data>);
    } catch (error) {
      next(error);
    }
  },
);

router.delete("/config", async (_req, res, next) => {
  try {
    await webDAVSyncService.deleteConfig();
    webDAVSyncService.stopAutoSync();
    res.status(200).json({
      success: true,
      message: "WebDAV 配置已删除。",
    } satisfies ApiResponse<null>);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/test",
  validate({ body: testConnectionSchema }),
  async (req, res, next) => {
    try {
      const testConfig = req.body as z.infer<typeof testConnectionSchema>;
      const result = await webDAVSyncService.testConnection(testConfig);
      res.status(200).json({
        success: result.success,
        message: result.message,
      } satisfies ApiResponse<null>);
    } catch (error) {
      next(error);
    }
  },
);

router.post("/sync", validate({ body: syncDirectionSchema }), async (req, res, next) => {
  try {
    const { direction } = req.body as z.infer<typeof syncDirectionSchema>;
    const result = await webDAVSyncService.sync(direction);
    res.status(200).json({
      success: result.success,
      data: result,
      message: result.message,
    } satisfies ApiResponse<typeof result>);
  } catch (error) {
    next(error);
  }
});

router.get("/status", async (_req, res, next) => {
  try {
    const config = await webDAVSyncService.getConfig();
    const state = await webDAVSyncService.getSyncState();
    const data = {
      isConfigured: !!config,
      autoSyncEnabled: config?.autoSyncEnabled ?? false,
      syncIntervalMinutes: config?.syncIntervalMinutes ?? 30,
      syncOnStartup: config?.syncOnStartup ?? false,
      ...state,
    };
    res.status(200).json({
      success: true,
      data,
      message: "获取同步状态成功。",
    } satisfies ApiResponse<typeof data>);
  } catch (error) {
    next(error);
  }
});

export default router;
