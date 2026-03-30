import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { queryKeys } from "@/api/queryKeys";
import {
  deleteWebDAVConfig,
  getWebDAVConfig,
  getWebDAVSyncStatus,
  saveWebDAVConfig,
  syncWebDAV,
  testWebDAVConnection,
} from "@/api/settings";

const DEFAULT_CONFIG = {
  serverUrl: "",
  username: "",
  password: "",
  remotePath: "/ai-novel-assistant",
  autoSyncEnabled: false,
  syncIntervalMinutes: 30,
  syncOnStartup: false,
};

export default function WebDAVSettingsCard() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(DEFAULT_CONFIG);
  const [testResult, setTestResult] = useState("");
  const [syncResult, setSyncResult] = useState("");

  const configQuery = useQuery({
    queryKey: queryKeys.settings.webdavConfig,
    queryFn: getWebDAVConfig,
  });

  const statusQuery = useQuery({
    queryKey: queryKeys.settings.webdavStatus,
    queryFn: getWebDAVSyncStatus,
    refetchInterval: 30000,
  });

  const saveMutation = useMutation({
    mutationFn: saveWebDAVConfig,
    onSuccess: async (response) => {
      setIsEditing(false);
      setTestResult("");
      setSyncResult(response.message ?? "配置已保存。");
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.webdavConfig });
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.webdavStatus });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWebDAVConfig,
    onSuccess: async () => {
      setForm(DEFAULT_CONFIG);
      setIsEditing(false);
      setTestResult("");
      setSyncResult("配置已删除。");
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.webdavConfig });
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.webdavStatus });
    },
  });

  const testMutation = useMutation({
    mutationFn: testWebDAVConnection,
    onSuccess: (response) => {
      setTestResult(response.message ?? "连接成功。");
    },
    onError: (error) => {
      setTestResult(error instanceof Error ? error.message : "连接失败。");
    },
  });

  const syncMutation = useMutation({
    mutationFn: (direction?: "upload" | "download" | "auto") => syncWebDAV(direction),
    onSuccess: (response) => {
      setSyncResult(response.message ?? "同步完成。");
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.webdavStatus });
    },
    onError: (error) => {
      setSyncResult(error instanceof Error ? error.message : "同步失败。");
    },
  });

  const config = configQuery.data?.data;
  const status = statusQuery.data?.data;
  const isConfigured = config?.isConfigured ?? false;

  const handleStartEdit = () => {
    if (config) {
      setForm({
        serverUrl: config.serverUrl,
        username: config.username,
        password: "",
        remotePath: config.remotePath,
        autoSyncEnabled: config.autoSyncEnabled,
        syncIntervalMinutes: config.syncIntervalMinutes,
        syncOnStartup: config.syncOnStartup,
      });
    } else {
      setForm(DEFAULT_CONFIG);
    }
    setIsEditing(true);
    setTestResult("");
    setSyncResult("");
  };

  const handleSave = () => {
    saveMutation.mutate(form);
  };

  const handleTest = () => {
    testMutation.mutate({
      serverUrl: form.serverUrl,
      username: form.username,
      password: form.password,
      remotePath: form.remotePath,
    });
  };

  const handleSync = (direction: "upload" | "download" | "auto") => {
    syncMutation.mutate(direction);
  };

  const formatLastSync = (lastSyncAt: string | null) => {
    if (!lastSyncAt) return "从未同步";
    return new Date(lastSyncAt).toLocaleString("zh-CN");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>WebDAV 同步</CardTitle>
            <CardDescription>
              通过 WebDAV 在多设备之间同步写作数据，实现不间断创作。
            </CardDescription>
          </div>
          <Badge variant={isConfigured ? "default" : "outline"}>
            {isConfigured ? "已配置" : "未配置"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="serverUrl">服务器地址</Label>
                <Input
                  id="serverUrl"
                  type="url"
                  placeholder="https://dav.example.com"
                  value={form.serverUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, serverUrl: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remotePath">远程路径</Label>
                <Input
                  id="remotePath"
                  placeholder="/ai-novel-assistant"
                  value={form.remotePath}
                  onChange={(e) => setForm((prev) => ({ ...prev, remotePath: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="用户名"
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="密码"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="flex items-center space-x-2">
                <Switch
                  id="autoSyncEnabled"
                  checked={form.autoSyncEnabled}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, autoSyncEnabled: checked }))}
                />
                <Label htmlFor="autoSyncEnabled">启用自动同步</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="syncOnStartup"
                  checked={form.syncOnStartup}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, syncOnStartup: checked }))}
                />
                <Label htmlFor="syncOnStartup">启动时同步</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="syncInterval">同步间隔（分钟）</Label>
                <Input
                  id="syncInterval"
                  type="number"
                  min={1}
                  max={1440}
                  value={form.syncIntervalMinutes}
                  onChange={(e) => setForm((prev) => ({ ...prev, syncIntervalMinutes: parseInt(e.target.value) || 30 }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "保存中..." : "保存"}
              </Button>
              <Button variant="secondary" onClick={handleTest} disabled={testMutation.isPending}>
                {testMutation.isPending ? "测试中..." : "测试连接"}
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                取消
              </Button>
            </div>
            {testResult && <div className="text-sm text-muted-foreground">{testResult}</div>}
          </div>
        ) : (
          <div className="space-y-4">
            {isConfigured && status ? (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">上次同步</div>
                  <div className="mt-1 font-medium">{formatLastSync(status.lastSyncAt)}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">同步状态</div>
                  <div className="mt-1">
                    <Badge variant={status.lastSyncStatus === "success" ? "default" : status.lastSyncStatus === "failed" ? "destructive" : "outline"}>
                      {status.lastSyncStatus === "success" ? "成功" : status.lastSyncStatus === "failed" ? "失败" : "未同步"}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">自动同步</div>
                  <div className="mt-1">
                    <Badge variant={status.autoSyncEnabled ? "default" : "outline"}>
                      {status.autoSyncEnabled ? `每 ${status.syncIntervalMinutes} 分钟` : "已关闭"}
                    </Badge>
                  </div>
                </div>
              </div>
            ) : null}
            {status?.lastSyncError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                上次同步错误：{status.lastSyncError}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleStartEdit}>
                {isConfigured ? "修改配置" : "配置 WebDAV"}
              </Button>
              {isConfigured && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => handleSync("auto")}
                    disabled={syncMutation.isPending}
                  >
                    {syncMutation.isPending ? "同步中..." : "自动同步"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleSync("upload")}
                    disabled={syncMutation.isPending}
                  >
                    上传
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleSync("download")}
                    disabled={syncMutation.isPending}
                  >
                    下载
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                  >
                    删除配置
                  </Button>
                </>
              )}
            </div>
            {syncResult && <div className="text-sm text-muted-foreground">{syncResult}</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
