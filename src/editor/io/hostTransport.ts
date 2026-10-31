/**
 * 宿主通信通道。
 *
 * 导演台运行在独立的 Tauri Webview 窗口里，window.parent 就是它自己，
 * 所以 postMessage 发出去没人收（这是之前「点发送没反应」的根本原因）。
 * Tauri 环境下改走事件总线：
 *   - 出站：__TAURI__.event.emit('director-desk:message', { instanceId, message })
 *   - 入站：__TAURI__.event.listen('director-desk:host-message', envelope)
 * 浏览器 iframe 预览（无 __TAURI__）仍回退到 postMessage。
 *
 * 本文件只负责把本版本已有的消息送达，不额外定义协议。
 */
const EVENT_TO_HOST = 'director-desk:message';
const EVENT_FROM_HOST = 'director-desk:host-message';

/** 本版本会从宿主接收的消息类型 */
const HOST_MESSAGE_TYPES = new Set([
  'storyai:director-desk-session',
  'storyai:director-desk-panorama',
]);

export type HostMessage = { type: string; payload?: Record<string, unknown> };

type HostEnvelope = { instanceId: string; message: HostMessage };

/**
 * 当前节点实例 id。
 * 导演台窗口被所有节点复用，URL 上的 instanceId 只在首次创建时写入，
 * 切换节点后就不再正确，因此由 session 消息刷新（见 hostBridge.openHostSession）。
 */
let currentInstanceId: string | null | undefined;

function normalizeInstanceId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128) return null;
  return trimmed;
}

function readInstanceIdFromUrl(): string | null {
  try {
    return normalizeInstanceId(new URLSearchParams(window.location.search).get('instanceId'));
  } catch {
    return null;
  }
}

function getTauriEvent(): any {
  if (typeof window === 'undefined') return null;
  const event = (window as any).__TAURI__?.event;
  if (!event || typeof event.emit !== 'function' || typeof event.listen !== 'function') return null;
  return event;
}

/** 取当前实例 id（首次取 URL 参数） */
export function getInstanceId(): string {
  if (currentInstanceId === undefined) currentInstanceId = readInstanceIdFromUrl();
  return currentInstanceId ?? '';
}

/** 宿主下发 session 时刷新实例 id，保证回传的截图能落到当前节点 */
export function setInstanceId(value: unknown): void {
  currentInstanceId = normalizeInstanceId(value);
}

function getHostOrigin(): string {
  return window.location.origin;
}

/** 解析宿主来信信封；结构不合法或类型不认识的一律丢弃 */
function parseHostEnvelope(value: unknown): HostEnvelope | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const instanceId = normalizeInstanceId(candidate.instanceId);
  if (!instanceId || !candidate.message || typeof candidate.message !== 'object') return null;
  const message = candidate.message as Record<string, unknown>;
  if (typeof message.type !== 'string' || !HOST_MESSAGE_TYPES.has(message.type)) return null;
  return {
    instanceId,
    message: {
      type: message.type,
      ...(message.payload ? { payload: message.payload as Record<string, unknown> } : {}),
    },
  };
}

/** 向宿主发送一条消息 */
export function postToHost(type: string, payload?: unknown): boolean {
  const message: HostMessage = { type };
  if (payload !== undefined) message.payload = payload as Record<string, unknown>;

  const event = getTauriEvent();
  const instanceId = getInstanceId();
  if (event && instanceId) {
    void event.emit(EVENT_TO_HOST, { instanceId, message }).catch((error: unknown) => {
      console.error('[cue3d] 向宿主发送消息失败', error);
    });
    return true;
  }

  try {
    window.parent?.postMessage(message, getHostOrigin());
  } catch {
    /* 跨域等异常静默 */
  }
  return false;
}

/** 订阅宿主消息，返回取消订阅函数 */
export function subscribeHostMessage(handler: (message: HostMessage) => void): () => void {
  const event = getTauriEvent();

  if (!event) {
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data;
      if (!data || typeof data !== 'object') return;
      const candidate = data as Record<string, unknown>;
      if (typeof candidate.type !== 'string' || !HOST_MESSAGE_TYPES.has(candidate.type)) return;
      handler(candidate as HostMessage);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }

  let unlisten: (() => void) | null = null;
  let disposed = false;

  void event
    .listen(EVENT_FROM_HOST, (ev: any) => {
      const envelope = parseHostEnvelope(ev?.payload);
      if (!envelope) return;
      // 切换节点瞬间可能残留旧节点的消息，只处理当前实例的
      if (envelope.message.type !== 'storyai:director-desk-session'
        && envelope.instanceId !== getInstanceId()) {
        return;
      }
      handler(envelope.message);
    })
    .then((dispose: () => void) => {
      if (disposed) {
        dispose();
        return;
      }
      unlisten = dispose;
    })
    .catch((error: unknown) => {
      console.error('[cue3d] 订阅宿主消息失败', error);
    });

  return () => {
    disposed = true;
    unlisten?.();
    unlisten = null;
  };
}
