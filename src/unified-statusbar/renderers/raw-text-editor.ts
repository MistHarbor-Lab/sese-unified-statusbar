// ===== 原始文本编辑器（大调查/大采访共用） =====
// 自包含主题变量 CSS，嵌套 overlay 叠在当前弹窗之上（模态套模态），取消只关本层。
import { type StyleType } from '../core/constants';
import { getToastr } from '../core/env';
import { syncDarkClass, syncDarkClassMinimal, releaseBackGuardIfIdle } from './html-builder';
import { showConfirmDialog } from './confirm-dialog';
import { escapeHtml } from '../core/html-escape';

export interface RawTextEditorOptions {
  /** 编辑框标题，如「编辑档案 · 张三」 */
  title: string;
  /** 预填的原始文本 */
  initialContent: string;
  style: StyleType;
  /** 保存回调：持久化 edited 文本；抛错则编辑器不关闭并提示 */
  onSave: (content: string) => Promise<void>;
  /** 保存成功后关闭编辑器并重渲染宿主弹窗 */
  afterSave: () => void;
}

const URE_CSS = `<style>
.ure-overlay{display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
.ure-dialog{--ure-bg:#f5ecdc;--ure-card:#fffaf0;--ure-text:#38271c;--ure-muted:#806d5d;--ure-line:#d4b98d;--ure-accent:#9d463b;--ure-accent-on:#fff;--ure-font:"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",serif;--ure-radius:8px;width:min(680px,100%);max-height:88vh;max-height:88dvh;display:flex;flex-direction:column;background:var(--ure-bg);border:1px solid var(--ure-line);border-radius:var(--ure-radius);color:var(--ure-text);font-family:var(--ure-font);box-shadow:0 20px 60px rgba(0,0,0,.35);overflow:hidden;box-sizing:border-box}
.ure-head{display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid var(--ure-line);background:var(--ure-card);flex-shrink:0}
.ure-title{flex:1;font-size:14px;font-weight:700;letter-spacing:1.5px}
.ure-sub{font-size:10.5px;opacity:.65;letter-spacing:0}
.ure-close{border:0;background:transparent;color:var(--ure-muted);cursor:pointer;font-size:18px;line-height:1;padding:0 4px;font-family:inherit}
.ure-close:hover{color:var(--ure-accent)}
.ure-body{flex:1;overflow:auto;padding:12px 16px;display:flex;flex-direction:column;gap:8px}
.ure-hint{font-size:10.5px;line-height:1.6;opacity:.7}
.ure-textarea{width:100%;box-sizing:border-box;min-height:48vh;max-height:60vh;resize:vertical;border:1px solid var(--ure-line);border-radius:var(--ure-radius);background:var(--ure-card);color:var(--ure-text);font:inherit;font-size:12.5px;line-height:1.7;padding:10px 12px;white-space:pre-wrap;word-break:break-word}
.ure-textarea:focus{outline:none;border-color:var(--ure-accent)}
.ure-count{font-size:10.5px;opacity:.6;text-align:right}
.ure-foot{display:flex;justify-content:flex-end;gap:8px;padding:10px 16px;border-top:1px solid var(--ure-line);background:var(--ure-card);flex-shrink:0}
.ure-btn{font-family:inherit;font-size:11px;letter-spacing:1.5px;padding:6px 16px;cursor:pointer;transition:all .2s;background:transparent;border:1px solid var(--ure-line);color:var(--ure-text);border-radius:var(--ure-radius)}
.ure-btn:hover{border-color:var(--ure-accent);color:var(--ure-accent)}
.ure-btn.primary{background:var(--ure-accent);border-color:var(--ure-accent);color:var(--ure-accent-on)}
.ure-btn.primary:hover{filter:brightness(1.12)}
.ure-btn:disabled{opacity:.4;cursor:default}

/* 瑟瑟 — 霓虹粉紫终端 */
.ure-flirtatious{--ure-bg:#0d0a18;--ure-card:#171126;--ure-text:#f4edff;--ure-muted:#9a8cac;--ure-line:#4f356d;--ure-accent:#ff4f9f;--ure-accent-on:#1a0a14;--ure-font:"Courier New",ui-monospace,monospace;--ure-radius:2px}

/* 萦绕 — 极简情报（深色靠 body.dark-mode） */
.ure-minimal{--ure-bg:#ededeb;--ure-card:#fff;--ure-text:#171717;--ure-muted:#666;--ure-line:#aaa;--ure-accent:#b22038;--ure-accent-on:#fff;--ure-font:"Courier New",ui-monospace,monospace;--ure-radius:0}

/* 甜恋糖果 — 粉红 */
.ure-sweet{--ure-bg:var(--sweet-bg,#fff0f5);--ure-card:var(--sweet-card,#fffafd);--ure-text:var(--sweet-text,#572d42);--ure-muted:var(--sweet-text-soft,#9b7386);--ure-line:var(--sweet-border,#efb6c9);--ure-accent:#d64e7c;--ure-accent-on:#fff;--ure-font:"Noto Sans SC","Noto Sans CJK SC","PingFang SC","Microsoft YaHei",sans-serif;--ure-radius:14px}

/* 云海仙踪 — 青蓝 */
.ure-xianxia{--ure-bg:#e8f1ee;--ure-card:#f7fbf8;--ure-text:#243d38;--ure-muted:#708c85;--ure-line:#a7c7be;--ure-accent:#278c82;--ure-accent-on:#e8f4f0;--ure-font:"Noto Serif SC","Noto Serif CJK SC","Songti SC","SimSun",serif;--ure-radius:6px}

/* 深空舰桥 — 复古未来（映射 --bridge-*） */
.ure-bridge{--ure-bg:var(--bridge-panel,#eef3f5);--ure-card:var(--bridge-panel-alt,#dde8eb);--ure-text:var(--bridge-text,#16222c);--ure-muted:var(--bridge-muted,#62757c);--ure-line:var(--bridge-line,#91a5ad);--ure-accent:var(--bridge-signal,#0a7189);--ure-accent-on:var(--bridge-signal-contrast,#fff);--ure-font:var(--bridge-font-ui,"Microsoft YaHei","PingFang SC",sans-serif);--ure-radius:0}

/* 灵动玻璃 — 系统灰面 · 系统蓝 */
.ure-ios{--ure-bg:#f2f2f7;--ure-card:#ffffff;--ure-text:#1c1c1e;--ure-muted:rgba(60,60,67,.62);--ure-line:rgba(60,60,67,.12);--ure-accent:#007aff;--ure-accent-on:#fff;--ure-font:var(--ios-font,-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei UI',sans-serif);--ure-radius:18px}

/* === 深色模式：sweet/xianxia/minimal 浅色对话框 --ure-* 翻深 === */
.panel-overlay.dark .ure-sweet,body.dark-mode .ure-sweet{--ure-bg:var(--sweet-bg,#241c28);--ure-card:var(--sweet-card,#2a1c2a);--ure-text:var(--sweet-text,#e8d8e0);--ure-muted:var(--sweet-text-soft,#b898a0);--ure-line:var(--sweet-border,#3a2a38)}
.panel-overlay.dark .ure-xianxia,body.dark-mode .ure-xianxia{--ure-bg:#19241e;--ure-card:#1f2e26;--ure-text:#cfe8df;--ure-muted:#8aa89e;--ure-line:#2a4038}
.panel-overlay.dark .ure-minimal,body.dark-mode .ure-minimal{--ure-bg:#1a1a1a;--ure-card:#222;--ure-text:#f0f0f0;--ure-muted:#999;--ure-line:#444}
.panel-overlay.dark .ure-ancient,body.dark-mode .ure-ancient{--ure-bg:#181515;--ure-card:#241f20;--ure-text:#f0e7e4;--ure-muted:#b29fa0;--ure-line:#514344}
.panel-overlay.dark .ure-flirtatious,body.dark-mode .ure-flirtatious{--ure-bg:#181515;--ure-card:#241f20;--ure-text:#f0e7e4;--ure-muted:#b29fa0;--ure-line:#514344}
.panel-overlay.dark .ure-ios,body.dark-mode .ure-ios{--ure-bg:#1c1c1e;--ure-card:#2c2c2e;--ure-text:#f2f2f7;--ure-muted:rgba(235,235,245,.62);--ure-line:rgba(235,235,245,.12);--ure-accent:#0a84ff}

@media(max-width:599px){.ure-overlay{padding:0}.ure-overlay .ure-dialog{width:100%;height:100vh;height:100dvh;max-height:none;border-radius:0}.ure-textarea{min-height:56vh}}
</style>`;

/** 打开原始文本编辑器（叠在当前弹窗之上，模态套模态）。 */
export function showRawTextEditor(opts: RawTextEditorOptions): void {
  const dlg = document.createElement('div');
  dlg.className = 'panel-overlay ure-overlay ure-' + opts.style + ' show';
  dlg.style.zIndex = '10025';
  if (opts.style === 'minimal') syncDarkClassMinimal(dlg); else syncDarkClass(dlg);

  const render = (): string => '<div class="ure-dialog">'
    + '<div class="ure-head"><span class="ure-title">' + escapeHtml(opts.title) + '</span><button type="button" class="ure-close" aria-label="关闭">&times;</button></div>'
    + '<div class="ure-body">'
    + '<div class="ure-hint">直接修改下方原始文本，保存后重新解析并刷新展示。空内容无法保存。</div>'
    + '<textarea class="ure-textarea" spellcheck="false"></textarea>'
    + '<div class="ure-count"></div>'
    + '</div>'
    + '<div class="ure-foot">'
    + '<button type="button" class="ure-btn" data-ure-action="cancel">取消</button>'
    + '<button type="button" class="ure-btn primary" data-ure-action="save">保存</button>'
    + '</div>'
    + '</div>';

  dlg.innerHTML = URE_CSS + render();
  document.body.appendChild(dlg);

  const textarea = dlg.querySelector<HTMLTextAreaElement>('.ure-textarea')!;
  const countEl = dlg.querySelector<HTMLElement>('.ure-count')!;
  textarea.value = opts.initialContent;

  const updateCount = (): void => {
    countEl.textContent = textarea.value.length + ' 字';
  };
  updateCount();
  textarea.addEventListener('input', updateCount);
  textarea.focus();

  const initialValue = textarea.value;

  // 有未保存修改时所有关闭路径（取消/×/遮罩/Esc）先确认，防长文本误触一键丢失
  const close = (): void => { dlg.remove(); releaseBackGuardIfIdle(); };
  const closeGuarded = (): void => {
    if (textarea.value === initialValue) { close(); return; }
    void showConfirmDialog({
      title: '放弃修改？',
      message: '当前内容尚未保存，关闭后将丢失本次修改。',
      okText: '放弃修改',
      cancelText: '继续编辑',
      danger: true,
    }).then((giveUp) => { if (giveUp) close(); });
  };

  const cancelBtn = dlg.querySelector<HTMLButtonElement>('[data-ure-action="cancel"]')!;
  cancelBtn.addEventListener('click', closeGuarded);

  const closeBtn = dlg.querySelector<HTMLButtonElement>('.ure-close')!;
  closeBtn.addEventListener('click', closeGuarded);

  // 点遮罩空白处关闭（拖选越界防护由 html-builder 的捕获期拦截兜底）
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) closeGuarded();
  });

  const saveBtn = dlg.querySelector<HTMLButtonElement>('[data-ure-action="save"]')!;
  saveBtn.addEventListener('click', async () => {
    const value = textarea.value;
    if (!value.trim()) {
      getToastr()?.warning('内容不能为空', '编辑提示');
      textarea.focus();
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中…';
    try {
      await opts.onSave(value);
      close();
      opts.afterSave();
    } catch (err) {
      getToastr()?.error(err instanceof Error ? err.message : '保存失败，请稍后重试', '编辑错误');
      saveBtn.disabled = false;
      saveBtn.textContent = '保存';
    }
  });

  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeGuarded();
  });
}
