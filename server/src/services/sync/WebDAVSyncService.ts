import { createClient, type WebDAVClient } from "webdav";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../db/prisma";

const WEBDAV_CONFIG_KEY = "webdav_sync_config";
const SYNC_STATE_KEY = "webdav_sync_state";

export interface WebDAVConfig {
  serverUrl: string;
  username: string;
  password: string;
  remotePath: string;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  syncOnStartup: boolean;
}

export interface SyncState {
  lastSyncAt: string | null;
  lastSyncStatus: "success" | "failed" | null;
  lastSyncError: string | null;
  localDatabaseMtime: number | null;
  remoteDatabaseMtime: number | null;
}

export interface SyncResult {
  success: boolean;
  message: string;
  direction?: "upload" | "download" | "none";
  localMtime?: number;
  remoteMtime?: number;
  syncedAt: string;
}

interface FileInfo {
  exists: boolean;
  mtime?: number;
  size?: number;
}

class WebDAVSyncService {
  private client: WebDAVClient | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;

  async getConfig(): Promise<WebDAVConfig | null> {
    const setting = await prisma.appSetting.findUnique({
      where: { key: WEBDAV_CONFIG_KEY },
    });
    if (!setting) return null;
    try {
      return JSON.parse(setting.value) as WebDAVConfig;
    } catch {
      return null;
    }
  }

  async saveConfig(config: WebDAVConfig): Promise<void> {
    await prisma.appSetting.upsert({
      where: { key: WEBDAV_CONFIG_KEY },
      update: { value: JSON.stringify(config) },
      create: { key: WEBDAV_CONFIG_KEY, value: JSON.stringify(config) },
    });
  }

  async deleteConfig(): Promise<void> {
    await prisma.appSetting.delete({
      where: { key: WEBDAV_CONFIG_KEY },
    }).catch(() => {});
  }

  async getSyncState(): Promise<SyncState> {
    const setting = await prisma.appSetting.findUnique({
      where: { key: SYNC_STATE_KEY },
    });
    if (!setting) {
      return {
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
        localDatabaseMtime: null,
        remoteDatabaseMtime: null,
      };
    }
    try {
      return JSON.parse(setting.value) as SyncState;
    } catch {
      return {
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
        localDatabaseMtime: null,
        remoteDatabaseMtime: null,
      };
    }
  }

  async saveSyncState(state: SyncState): Promise<void> {
    await prisma.appSetting.upsert({
      where: { key: SYNC_STATE_KEY },
      update: { value: JSON.stringify(state) },
      create: { key: SYNC_STATE_KEY, value: JSON.stringify(state) },
    });
  }

  private createClient(config: WebDAVConfig): WebDAVClient {
    return createClient(config.serverUrl, {
      username: config.username,
      password: config.password,
    });
  }

  async testConnection(config: WebDAVConfig): Promise<{ success: boolean; message: string }> {
    try {
      const client = this.createClient(config);
      await client.getDirectoryContents(config.remotePath);
      return { success: true, message: "连接成功，远程目录可访问。" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "连接失败";
      return { success: false, message: `连接失败：${message}` };
    }
  }

  private getDatabasePath(): string {
    const dbPath = process.env.DATABASE_URL?.replace("file:", "") || "dev.db";
    if (path.isAbsolute(dbPath)) {
      return dbPath;
    }
    return path.resolve(process.cwd(), dbPath);
  }

  private async getLocalDatabaseInfo(): Promise<FileInfo> {
    try {
      const dbPath = this.getDatabasePath();
      const stats = await fs.stat(dbPath);
      return {
        exists: true,
        mtime: stats.mtimeMs,
        size: stats.size,
      };
    } catch {
      return { exists: false };
    }
  }

  private async getRemoteFileInfo(client: WebDAVClient, remotePath: string): Promise<FileInfo> {
    try {
      const stat = await client.stat(remotePath);
      if ("lastModified" in stat && stat.lastModified) {
        return {
          exists: true,
          mtime: new Date(stat.lastModified).getTime(),
          size: "size" in stat ? (stat.size as number) : undefined,
        };
      }
      return { exists: true };
    } catch {
      return { exists: false };
    }
  }

  async sync(direction?: "upload" | "download" | "auto"): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        message: "同步正在进行中，请稍后再试。",
        syncedAt: new Date().toISOString(),
      };
    }

    const config = await this.getConfig();
    if (!config) {
      return {
        success: false,
        message: "未配置 WebDAV 同步。",
        syncedAt: new Date().toISOString(),
      };
    }

    this.isSyncing = true;
    const client = this.createClient(config);
    const dbPath = this.getDatabasePath();
    const remoteDbPath = `${config.remotePath}/novel-assistant.db`;

    try {
      await client.createDirectory(config.remotePath, { recursive: true }).catch(() => {});

      const localInfo = await this.getLocalDatabaseInfo();
      const remoteInfo = await this.getRemoteFileInfo(client, remoteDbPath);

      if (!localInfo.exists && !remoteInfo.exists) {
        return {
          success: true,
          message: "本地和远程均无数据库文件，无需同步。",
          direction: "none",
          syncedAt: new Date().toISOString(),
        };
      }

      let syncDirection: "upload" | "download" | "none";
      if (direction === "upload") {
        syncDirection = "upload";
      } else if (direction === "download") {
        syncDirection = "download";
      } else {
        if (!localInfo.exists) {
          syncDirection = "download";
        } else if (!remoteInfo.exists) {
          syncDirection = "upload";
        } else if (localInfo.mtime && remoteInfo.mtime) {
          syncDirection = localInfo.mtime > remoteInfo.mtime ? "upload" : "download";
        } else {
          syncDirection = "upload";
        }
      }

      if (syncDirection === "upload") {
        if (!localInfo.exists) {
          return {
            success: false,
            message: "本地数据库不存在，无法上传。",
            syncedAt: new Date().toISOString(),
          };
        }
        const fileContent = await fs.readFile(dbPath);
        await client.putFileContents(remoteDbPath, fileContent, { overwrite: true });
        
        await this.saveSyncState({
          lastSyncAt: new Date().toISOString(),
          lastSyncStatus: "success",
          lastSyncError: null,
          localDatabaseMtime: localInfo.mtime ?? null,
          remoteDatabaseMtime: Date.now(),
        });

        return {
          success: true,
          message: "数据库已上传到 WebDAV。",
          direction: "upload",
          localMtime: localInfo.mtime,
          syncedAt: new Date().toISOString(),
        };
      } else if (syncDirection === "download") {
        if (!remoteInfo.exists) {
          return {
            success: false,
            message: "远程数据库不存在，无法下载。",
            syncedAt: new Date().toISOString(),
          };
        }
        const remoteContent = await client.getFileContents(remoteDbPath);
        const buffer = Buffer.isBuffer(remoteContent) 
          ? remoteContent 
          : Buffer.from(remoteContent as ArrayBuffer);
        await fs.writeFile(dbPath, buffer);

        await this.saveSyncState({
          lastSyncAt: new Date().toISOString(),
          lastSyncStatus: "success",
          lastSyncError: null,
          localDatabaseMtime: Date.now(),
          remoteDatabaseMtime: remoteInfo.mtime ?? null,
        });

        return {
          success: true,
          message: "数据库已从 WebDAV 下载。",
          direction: "download",
          remoteMtime: remoteInfo.mtime,
          syncedAt: new Date().toISOString(),
        };
      }

      return {
        success: true,
        message: "本地和远程数据库时间戳相同，无需同步。",
        direction: "none",
        localMtime: localInfo.mtime,
        remoteMtime: remoteInfo.mtime,
        syncedAt: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      await this.saveSyncState({
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: "failed",
        lastSyncError: errorMessage,
        localDatabaseMtime: null,
        remoteDatabaseMtime: null,
      });

      return {
        success: false,
        message: `同步失败：${errorMessage}`,
        syncedAt: new Date().toISOString(),
      };
    } finally {
      this.isSyncing = false;
    }
  }

  startAutoSync(): void {
    this.stopAutoSync();
    
    this.getConfig().then((config) => {
      if (!config?.autoSyncEnabled) return;
      
      const intervalMs = config.syncIntervalMinutes * 60 * 1000;
      this.syncTimer = setInterval(() => {
        this.sync("auto").catch(console.error);
      }, intervalMs);
      
      console.log(`[WebDAV] 自动同步已启动，间隔 ${config.syncIntervalMinutes} 分钟`);
    });
  }

  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log("[WebDAV] 自动同步已停止");
    }
  }

  async syncOnStartup(): Promise<void> {
    const config = await this.getConfig();
    if (config?.syncOnStartup) {
      console.log("[WebDAV] 启动时同步已启用，正在同步...");
      const result = await this.sync("auto");
      console.log(`[WebDAV] 启动同步结果：${result.message}`);
    }
  }
}

export const webDAVSyncService = new WebDAVSyncService();
