// ===== TauriTavern 托管聊天区检测（零依赖） =====
// TT 开启「聊天虚拟化」（chat_virtualization_enabled，默认关、opt-in）后 #chat 由宿主
// ChatSurface 托管：外来子节点（follow-bottom 的 wrapper / 浮动选项栏）无法稳定存在。
// __TAURITAVERN__.api.chatSurface.isManagedOwnershipRequired 是 TT 提供给参与者自检的
// 官方口径；其底层在 TT 设置未初始化时会 throw，必须 try/catch。
// 非 TT / 虚拟化关 / ABI 未就绪一律 false —— 原版酒馆行为零变化。
// 注意：build-statusbar.cjs 的 loader 侧内联了逐字同款逻辑（managedChatSurface），
// 改本文件口径时必须同步改 loader 侧，双侧一致。

/** TT 托管聊天区是否接管 #chat（每次求值，跟随用户开关虚拟化的变化）。 */
export function isTtManagedChatSurface(win: Window = window): boolean {
  try {
    const tt = (win as unknown as Record<string, any>).__TAURITAVERN__;
    return !!(
      tt?.api?.chatSurface
      && typeof tt.api.chatSurface.isManagedOwnershipRequired === 'function'
      && tt.api.chatSurface.isManagedOwnershipRequired() === true
    );
  } catch (_e) {
    return false;
  }
}

/**
 * 布局模式生效口径：follow-bottom 且 #chat 被 TT 托管时回退 fixed-top（托管聊天区
 * 容纳不了外来子节点）。不写回配置——用户选择保留，非托管环境自动还原。
 */
export function effectivePositionMode(mode: string, win: Window = window): string {
  return mode === 'follow-bottom' && isTtManagedChatSurface(win) ? 'fixed-top' : mode;
}
