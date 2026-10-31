import { useDirectorStore } from "../store/directorStore";
import { postToHost, setInstanceId, subscribeHostMessage } from './hostTransport';

interface HostPanoramaPayload {
  edgeId?: unknown;
  sourceNodeId?: unknown;
  imageUrl?: unknown;
  fileName?: unknown;
}

interface HostSessionPayload {
  instanceId?: unknown;
  theme?: unknown;
}

export interface HostCaptureItemPayload {
  dataUrl?: unknown;
  fileName?: unknown;
}

export interface HostCaptureBatchPayload {
  captures?: HostCaptureItemPayload[];
}

interface HostConnectedPanorama {
  edgeId: string;
  sourceNodeId: string;
}

let initialized = false;
let hostConnectedPanorama: HostConnectedPanorama | null = null;
let removeUnsubscribe: (() => void) | null = null;
let removeHostMessageUnsubscribe: (() => void) | null = null;
let suppressNextPanoramaRemovalNotice = false;

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTheme(value: unknown): "dark" | "light" | null {
  return value === "light" || value === "dark" ? value : null;
}

function applyDirectorDeskTheme(theme: "dark" | "light") {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function getInitialHostTheme() {
  try {
    return normalizeTheme(new URLSearchParams(window.location.search).get("theme"));
  } catch {
    return null;
  }
}

function notifyPanoramaRemoved() {
  if (!hostConnectedPanorama) {
    return;
  }

  postToHost("storyai:director-desk-panorama-removed", hostConnectedPanorama);
  hostConnectedPanorama = null;
}

function subscribeToPanoramaRemoval() {
  if (removeUnsubscribe) {
    return;
  }

  let previousPanoramaAssetId = useDirectorStore.getState().project.panoramaAssetId;
  removeUnsubscribe = useDirectorStore.subscribe((state) => {
    const nextPanoramaAssetId = state.project.panoramaAssetId;

    if (previousPanoramaAssetId && !nextPanoramaAssetId) {
      if (suppressNextPanoramaRemovalNotice) {
        suppressNextPanoramaRemovalNotice = false;
        hostConnectedPanorama = null;
      } else {
        notifyPanoramaRemoved();
      }
    }

    previousPanoramaAssetId = nextPanoramaAssetId;
  });
}

function importHostPanorama(payload: HostPanoramaPayload) {
  const imageUrl = normalizeString(payload.imageUrl);
  if (!imageUrl) {
    return;
  }

  const fileName = normalizeString(payload.fileName) || "画布全景图.png";
  const edgeId = normalizeString(payload.edgeId);
  const sourceNodeId = normalizeString(payload.sourceNodeId);

  hostConnectedPanorama = edgeId && sourceNodeId ? { edgeId, sourceNodeId } : null;
  useDirectorStore.getState().addImportedAsset({
    kind: "panorama",
    name: fileName,
    fileName,
    url: imageUrl,
    projectionMode: "backdrop",
  });
}

function openHostSession(payload: HostSessionPayload) {
  const instanceId = normalizeString(payload.instanceId);
  const theme = normalizeTheme(payload.theme);
  if (theme) {
    applyDirectorDeskTheme(theme);
  }
  // 窗口被所有节点复用，URL 上的 instanceId 只在首次创建时有效，
  // 切换节点后必须用 session 带来的 id，否则回传的截图会落到上一个节点。
  if (instanceId) {
    setInstanceId(instanceId);
  }
  suppressNextPanoramaRemovalNotice = Boolean(useDirectorStore.getState().project.panoramaAssetId);
  useDirectorStore.getState().openScopedScene(instanceId || null);
  suppressNextPanoramaRemovalNotice = false;
  hostConnectedPanorama = null;
}

export function postDirectorDeskCapturesToHost(
  captures: Array<{
    dataUrl: string;
    fileName?: string;
  }>
) {
  const normalizedCaptures = captures
    .map((capture, index) => {
      const dataUrl = normalizeString(capture.dataUrl);
      if (!dataUrl) {
        return null;
      }

      return {
        dataUrl,
        fileName: normalizeString(capture.fileName) || `director-desk-capture-${index + 1}.png`,
      };
    })
    .filter((capture): capture is { dataUrl: string; fileName: string } => Boolean(capture));

  if (normalizedCaptures.length === 0) {
    return;
  }

  const capturePayload = { captures: normalizedCaptures };
  postToHost("storyai:director-desk-captures-sent", capturePayload);
}

/** 运镜视频发送上限：宿主单文件落盘上限为 64MB */
export const MAX_HOST_VIDEO_BYTES = 64 * 1024 * 1024;

export type VideoSendResult = "sent" | "too-large" | "failed";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("读取录制结果失败"));
    reader.readAsDataURL(blob);
  });
}

/** 把录好的运镜动画发给宿主（画布节点），本地下载由调用方负责 */
export async function postDirectorDeskVideoToHost(
  blob: Blob,
  fileName: string,
): Promise<VideoSendResult> {
  if (blob.size > MAX_HOST_VIDEO_BYTES) {
    return "too-large";
  }

  try {
    const dataUrl = await blobToDataUrl(blob);
    if (!dataUrl.startsWith("data:video/")) {
      return "failed";
    }
    postToHost("storyai:director-desk-video-sent", { dataUrl, fileName });
    return "sent";
  } catch {
    return "failed";
  }
}

function handleHostMessage(message: { type?: string; payload?: unknown }) {
  if (!message || typeof message.type !== "string") {
    return;
  }

  if (message.type === "storyai:director-desk-session") {
    openHostSession((message.payload || {}) as HostSessionPayload);
    return;
  }

  if (message.type === "storyai:director-desk-panorama") {
    importHostPanorama((message.payload || {}) as HostPanoramaPayload);
  }
}

export function initDirectorDeskHostBridge() {
  if (initialized) {
    return;
  }

  initialized = true;
  applyDirectorDeskTheme(getInitialHostTheme() ?? "dark");
  removeHostMessageUnsubscribe = subscribeHostMessage(handleHostMessage);
  subscribeToPanoramaRemoval();
}

export function clearDirectorDeskHostBridge() {
  if (!initialized) {
    return;
  }

  initialized = false;
  hostConnectedPanorama = null;
  suppressNextPanoramaRemovalNotice = false;
  removeHostMessageUnsubscribe?.();
  removeHostMessageUnsubscribe = null;
  removeUnsubscribe?.();
  removeUnsubscribe = null;
}
