/**
 * 导演台与宿主的通信链路（tauri-event-v1）。
 * 覆盖：出站信封结构、窗口复用切换节点后的实例 id、跨实例消息过滤、运镜视频发送与体积上限。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

type EmitCall = [string, { instanceId: string; message: { type: string; payload?: any } }];

function installTauriMock() {
  const emit = vi.fn((_name: string, _payload: unknown) => Promise.resolve());
  let listener: ((ev: { payload: unknown }) => void) | null = null;
  const listen = vi.fn((_name: string, cb: (ev: { payload: unknown }) => void) => {
    listener = cb;
    return Promise.resolve(() => {});
  });
  (window as any).__TAURI__ = { event: { emit, listen } };
  return {
    emit,
    listen,
    deliver: (payload: unknown) => listener?.({ payload }),
    calls: () => emit.mock.calls as unknown as EmitCall[],
  };
}

describe('导演台与宿主通信', () => {
  beforeEach(() => {
    vi.resetModules();
    window.history.replaceState({}, '', '/index.html?instanceId=inst-abc&theme=dark&transport=tauri');
  });

  it('发送截图时走 Tauri 事件，信封含 instanceId 与 captures 负载', async () => {
    const mock = installTauriMock();
    const { postDirectorDeskCapturesToHost } = await import('./hostBridge');

    postDirectorDeskCapturesToHost([{ dataUrl: 'data:image/png;base64,AAA', fileName: '镜头1.png' }]);

    expect(mock.emit).toHaveBeenCalledTimes(1);
    const [eventName, envelope] = mock.calls()[0];
    expect(eventName).toBe('director-desk:message');
    expect(envelope.instanceId).toBe('inst-abc');
    expect(envelope.message.type).toBe('storyai:director-desk-captures-sent');
    expect(envelope.message.payload?.captures).toEqual([
      { dataUrl: 'data:image/png;base64,AAA', fileName: '镜头1.png' },
    ]);
  });

  it('窗口复用切换到新节点后，回传使用 session 携带的新 instanceId', async () => {
    const mock = installTauriMock();
    const mod = await import('./hostBridge');
    mod.initDirectorDeskHostBridge();
    await Promise.resolve();

    mock.deliver({
      instanceId: 'inst-new',
      message: { type: 'storyai:director-desk-session', payload: { instanceId: 'inst-new', theme: 'dark' } },
    });

    mod.postDirectorDeskCapturesToHost([{ dataUrl: 'data:image/png;base64,BBB' }]);

    const last = mock.calls()[mock.calls().length - 1];
    expect(last[1].instanceId).toBe('inst-new');
    expect(last[1].message.type).toBe('storyai:director-desk-captures-sent');
  });

  it('录制完成后把运镜视频发给宿主，超过 64MB 则拒发', async () => {
    const mock = installTauriMock();
    const { postDirectorDeskVideoToHost, MAX_HOST_VIDEO_BYTES } = await import('./hostBridge');

    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'video/webm' });
    await expect(postDirectorDeskVideoToHost(blob, '机位01-path-animation.webm')).resolves.toBe('sent');

    const last = mock.calls()[mock.calls().length - 1];
    expect(last[0]).toBe('director-desk:message');
    expect(last[1].instanceId).toBe('inst-abc');
    expect(last[1].message.type).toBe('storyai:director-desk-video-sent');
    expect(last[1].message.payload?.fileName).toBe('机位01-path-animation.webm');
    expect(String(last[1].message.payload?.dataUrl).startsWith('data:video/webm')).toBe(true);

    // 超过上限直接拒发，不做 base64 转换
    const oversized = { size: MAX_HOST_VIDEO_BYTES + 1, type: 'video/webm' } as unknown as Blob;
    await expect(postDirectorDeskVideoToHost(oversized, 'big.webm')).resolves.toBe('too-large');
    expect(mock.calls()).toHaveLength(1);
  });

  it('其他节点的消息被过滤，不会串到当前节点', async () => {    const mock = installTauriMock();
    const mod = await import('./hostBridge');
    const { useDirectorStore } = await import('../store/directorStore');
    mod.initDirectorDeskHostBridge();
    await Promise.resolve();

    const importAsset = vi.spyOn(useDirectorStore.getState(), 'addImportedAsset');

    mock.deliver({
      instanceId: 'inst-other',
      message: {
        type: 'storyai:director-desk-panorama',
        payload: { imageUrl: 'https://example.com/p.jpg', fileName: '全景.jpg' },
      },
    });
    expect(importAsset).not.toHaveBeenCalled();

    mock.deliver({
      instanceId: 'inst-abc',
      message: {
        type: 'storyai:director-desk-panorama',
        payload: { imageUrl: 'https://example.com/p.jpg', fileName: '全景.jpg' },
      },
    });
    expect(importAsset).toHaveBeenCalledTimes(1);
  });
});
