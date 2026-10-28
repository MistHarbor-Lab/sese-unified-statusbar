// ===== 持续任务通知：生成期间常驻 + 可选「终止」按钮（正文插图 / 世界演化共用）=====
// 用宿主 toastr（酒馆 #toast-container），timeOut:0 常驻。
// 注意：酒馆 toastr 全局开启 escapeHtml，message 里的 HTML 会被转义成纯文本显示——
// 因此进度文案走 createTextNode、终止按钮走真实 DOM 元素（直接绑 click），
// 由本模块自行拼装 .toast-message 容器内容，不依赖 toastr 渲染 HTML。
import { getToastr } from './env';

export interface TaskNoticeHandle {
  /** 更新进度文案（保留终止按钮）。 */
  update(message: string): void;
  /** 关闭通知。 */
  close(): void;
}

const ABORT_BTN_CLASS = 'ub-task-abort';

function hostDocument(): Document | null {
  try { return (window.parent as any).document || document; } catch (_e) { return document; }
}

/**
 * 显示常驻任务通知（不自动消失，须 close() 或点右上角关闭）。
 * abortable 时附带「终止」按钮：点击即调 onAbort（一次），按钮转为「终止中…」不可再点。
 */
export function showTaskNotice(title: string, message: string, opts?: { abortable?: boolean; onAbort?: () => void }): TaskNoticeHandle {
  const toastr: any = getToastr();
  if (!toastr?.info) return { update: (): void => {}, close: (): void => {} };
  const abortable = !!(opts?.abortable && typeof opts.onAbort === 'function');
  let el: any = null;
  try {
    el = toastr.info(message, title || '', {
      timeOut: 0,
      extendedTimeOut: 0,
      tapToDismiss: false,
      closeButton: true,
    });
  } catch (_e) { /* ignore */ }
  const doc = hostDocument();
  const container: HTMLElement | undefined = el?.find?.('.toast-message')?.get?.(0);
  let textNode: Text | null = null;
  let btn: HTMLButtonElement | null = null;
  if (container && doc) {
    if (abortable) {
      btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = ABORT_BTN_CLASS;
      btn.textContent = '终止';
      btn.style.marginLeft = '10px';
      btn.style.padding = '4px 12px';
      btn.style.fontSize = '12px';
      btn.style.lineHeight = '1.4';
      btn.style.minHeight = '28px';
      btn.style.cursor = 'pointer';
      btn.style.border = '1px solid currentColor';
      btn.style.borderRadius = '3px';
      btn.style.background = 'transparent';
      btn.style.color = 'inherit';
      let fired = false;
      btn.addEventListener('click', (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        if (fired) return;
        fired = true;
        btn!.textContent = '终止中…';
        btn!.disabled = true;
        btn!.style.opacity = '.55';
        // 宣告前移（对齐数据库填表「先宣告后收尾」）：点击瞬间即改通知文案为已终止，
        // 请求中断与写回落盘等收尾在后台完成——不等异步链路退出才让用户看到结果。
        if (textNode) textNode.nodeValue = '已终止，正在收尾…';
        try { opts!.onAbort!(); } catch (_e) { /* ignore */ }
      });
    }
    const render = (msg: string): void => {
      container.textContent = '';
      textNode = doc.createTextNode(msg);
      container.appendChild(textNode);
      if (btn) container.appendChild(btn);
    };
    render(message);
  }
  return {
    update(next: string): void {
      if (textNode) textNode.nodeValue = next;
    },
    close(): void {
      // toastr.clear 对 timeOut:0 常驻 toast 偶尔不生效（通知留在页面上不消失），
      // 故不依赖它：先尝试 toastr.clear，再无条件移除 DOM 节点兜底。
      // 必须 force：终止按钮在 toast 内，toastr 2.x 遇「toast 内有焦点」会拒绝单条隐藏并退化为
      // 清空整个 #toast-container（连数据库填表等别人的常驻通知一起清掉）。
      try { if (el && typeof toastr.clear === 'function') toastr.clear(el, { force: true }); } catch (_e) { /* ignore */ }
      try { el?.remove?.(); } catch (_e) { /* ignore */ }
    },
  };
}
