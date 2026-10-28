import type { StyleType } from '../core/constants';
import { getToastr } from '../core/env';
import { getConfig, setConfig } from '../core/config-store';
import { resolveCharacterWorldbookTemplate } from '../core/character-worldbook-config';
import { applyApprovedWorldbookChanges, createDefaultCharacterWorldbookService, locateWorldbookChange, restoreMacroTokens, wrapCharacterWorldbookContent, type AppliedWorldbookChanges, type ApprovedWorldbookChange, type PreparedCharacterWorldbookUpdate } from '../core/character-worldbook';
import { requestCharacterWorldbookCreation, requestCharacterWorldbookUpdate } from '../core/character-worldbook-ai';
import { clearCharacterWorldbookBackgroundTask, getCharacterWorldbookBackgroundTask, startCharacterWorldbookBackgroundTask, type CharacterWorldbookBackgroundMode } from '../core/character-worldbook-background';
import { NSFW_TRAIT_POOL, PERSONALITY_TRAIT_POOL, TRAIT_POOL_COUNT_MAX, TRAIT_POOL_COUNT_MIN, normalizeTraitPoolState, pickRandomTraitTags, type CharacterWorldbookTraitPoolState } from '../core/character-trait-pools';
import { commitPendingEncounter, listPendingEncounters } from '../core/character-pending-encounter';
import { getSheetByName } from '../core/data-manager';
import { ubIcon } from '../core/icons';
import { diffText } from '../core/text-diff';
import { escapeHtml, escapeHtmlAttr } from '../core/html-escape';
import { bridgeWindowClass, markPopupShown, syncDarkClass, syncDarkClassMinimal } from './html-builder';

export interface CharacterWorldbookDialogArgs {
  mode: 'create' | 'update';
  style: StyleType;
  characterName: string;
  /** true = 新人物创建（角色中枢入口）：不收集角色表与角色条目，写完后登记待相遇名单。 */
  fresh?: boolean;
  restoreHub: () => void;
  onCommitted: () => void;
}

interface CharacterWorldbookBackgroundPayload {
  snapshot: any;
  prepared: PreparedCharacterWorldbookUpdate | null;
  createdContent: string;
  changes: ApprovedWorldbookChange[];
}

function appendHtml(parent: Element, html: string): void {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  parent.append(template.content);
}

function errorText(error: unknown): string { return error instanceof Error ? error.message : String(error || '未知错误'); }

/** 恋爱/重要角色表现有姓名集合（新人物重名防线）。 */
function readRosterNames(): Set<string> {
  const out = new Set<string>();
  for (const table of ['恋爱对象表', '重要角色表']) {
    const sheet = getSheetByName(table);
    if (!sheet?.content?.length) continue;
    const headers = (sheet.content[0] || []).map(value => String(value || '').trim());
    const col = headers.indexOf('姓名');
    if (col === -1) continue;
    for (let i = 1; i < sheet.content.length; i++) out.add(String(sheet.content[i]?.[col] || '').trim());
  }
  return out;
}

type PoolKind = 'personality' | 'nsfw';

export function showCharacterWorldbookDialog(args: CharacterWorldbookDialogArgs): void {
  const overlay = document.getElementById('panelOverlay');
  if (!overlay) return;
  const service = createDefaultCharacterWorldbookService();
  const config = args.mode === 'create' ? getConfig() : null;
  const library = config ? { templates: config.characterWorldbookTemplates, activeCreateTemplateId: config.characterWorldbookCreateTemplateId } : null;
  const activeTemplate = library ? resolveCharacterWorldbookTemplate(library) : null;
  // 特质池仅在创建流程可用；状态即源（抽取/清空/改数量立即落盘，跨弹窗保留）
  let poolState: CharacterWorldbookTraitPoolState | null = config ? normalizeTraitPoolState(config.characterWorldbookTraitPools) : null;
  const root = document.createElement('div');
  // char-hub-theme-* 挂上以解析 --hub-* token（否则 var() 无定义回退初始值）；hub 内部皮选择器都带 .char-hub-popup 前缀不会被误伤
  root.className = (args.style === 'bridge' ? bridgeWindowClass('character-worldbook', 'l') : 'panel-popup ub-popup--l') + ` char-worldbook-dialog char-worldbook-${args.fresh ? 'create-fresh' : args.mode} char-hub-theme-${args.style}`;
  if (args.style === 'minimal') syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  overlay.replaceChildren(root); overlay.classList.add('show'); markPopupShown();
  const taskMode: CharacterWorldbookBackgroundMode = args.fresh ? 'create-fresh' : args.mode;
  const activeTask = getCharacterWorldbookBackgroundTask<CharacterWorldbookBackgroundPayload>();
  const resumedTask = activeTask?.status === 'ready' && activeTask.mode === taskMode && (args.fresh || activeTask.characterName === args.characterName) ? activeTask : null;
  // 新人物模式的姓名来自弹窗输入/后台任务；常规模式来自角色详情
  let subjectName = args.fresh ? (resumedTask?.characterName || '') : args.characterName;
  let prepared: PreparedCharacterWorldbookUpdate | null = resumedTask?.value?.prepared || null;
  let createdContent = resumedTask?.value?.createdContent || '';
  let changes: ApprovedWorldbookChange[] = resumedTask?.value?.changes || [];
  const close = (): void => args.restoreHub();
  const titleText = args.mode === 'update' ? '更新角色世界书条目' : args.fresh ? '新人物创建' : '创建角色世界书条目';
  const render = (body: string, title = titleText): void => {
    root.replaceChildren();
    appendHtml(root, `<div class="panel-popup-head"><div class="panel-popup-title">${escapeHtml(title)}</div><button type="button" class="panel-popup-close" data-char-worldbook-close>&times;</button></div><div class="char-worldbook-body">${body}</div>`);
  };
  const poolTagsHtml = (kind: PoolKind): string => {
    const tags = kind === 'personality' ? poolState!.personalityTags : poolState!.nsfwTags;
    if (!tags.length) return '<span class="char-worldbook-pool-empty">未抽取——留空即不启用此池</span>';
    return tags.map(tag => `<span class="char-worldbook-pool-tag">${escapeHtml(tag)}<button type="button" data-char-worldbook-pool-remove="${kind}" data-tag="${escapeHtmlAttr(tag)}" aria-label="移除 ${escapeHtmlAttr(tag)}">&times;</button></span>`).join('');
  };
  const poolSection = (kind: PoolKind): string => {
    if (!poolState) return '';
    const isPersonality = kind === 'personality';
    const count = isPersonality ? poolState.personalityCount : poolState.nsfwCount;
    const tagCount = (isPersonality ? poolState.personalityTags : poolState.nsfwTags).length;
    return `<section class="char-worldbook-pool" data-char-worldbook-pool="${kind}"><header class="char-worldbook-pool-head"><b>${isPersonality ? '性格池' : 'NSFW 特质池'}${tagCount ? `<i class="char-worldbook-pool-count">${tagCount}</i>` : ''}</b><span class="char-worldbook-pool-actions"><button class="settings-action-btn" type="button" data-char-worldbook-pool-roll="${kind}">${ubIcon('dice')} 随机抽取</button><button class="settings-action-btn" type="button" data-char-worldbook-pool-clear="${kind}">清空</button></span></header><label>抽取数量（${TRAIT_POOL_COUNT_MIN}-${TRAIT_POOL_COUNT_MAX}）<input data-char-worldbook-pool-count="${kind}" type="number" min="${TRAIT_POOL_COUNT_MIN}" max="${TRAIT_POOL_COUNT_MAX}" value="${count}"></label><div class="char-worldbook-pool-tags">${poolTagsHtml(kind)}</div><p class="char-worldbook-pool-hint">${isPersonality ? '抽取后生成时会把所选性格尽量自然地融入人物塑造；清空则不启用。' : '抽取后生成时会把所选 NSFW 特质融入性爱参数与身体特质；清空则不启用。'}</p></section>`;
  };
  const persistPool = (): void => { if (!poolState) return; poolState = normalizeTraitPoolState(poolState); setConfig('characterWorldbookTraitPools', poolState); };
  const refreshPoolSection = (kind: PoolKind): void => {
    const section = root.querySelector<HTMLElement>(`[data-char-worldbook-pool="${kind}"]`);
    if (section && poolState) section.outerHTML = poolSection(kind);
  };
  const sourceForm = (updateCandidates = ''): string => {
    const templates = library?.templates.map(item => `<option value="${escapeHtmlAttr(item.id)}"${item.id === activeTemplate?.id ? ' selected' : ''}>${escapeHtml(item.name)}${item.builtIn ? '（内置）' : ''}</option>`).join('') || '';
    const templateControl = args.mode === 'create' ? `<label>模板<select data-char-worldbook-template>${templates}</select></label>` : '';
    const nameControl = args.fresh ? `<label>人物姓名<input data-char-worldbook-name maxlength="30" placeholder="新人物的姓名，将作为世界书条目的触发关键词" value="${escapeHtmlAttr(subjectName)}"></label>` : '';
    const introText = args.fresh
      ? '为一位尚未出场的新人物创建世界书档案：取材只含当前角色卡主世界书的蓝灯/绿灯条目与最近纪要，不读取任何角色表。审核通过写入后，人物会以「待相遇」占位出现在角色中枢。'
      : '仅使用当前角色卡绑定的主世界书。取材会在生成前冻结，生成过程不会写入任何世界书。';
    const poolBlocks = args.mode === 'create' ? poolSection('personality') + poolSection('nsfw') : '';
    return `<section class="char-worldbook-source"><p>${introText}</p>${nameControl}${updateCandidates}${templateControl}<label>纪要数量（默认 20）<input data-char-worldbook-count type="number" min="1" max="100" value="20"></label>${poolBlocks}<label>额外要求<textarea data-char-worldbook-extra placeholder="可补充写作侧重、禁忌或细节要求"></textarea></label><button class="settings-action-btn" type="button" data-char-worldbook-generate>生成并进入审核</button></section>`;
  };
  const showCreate = (): void => render(sourceForm(), (args.fresh ? '新人物创建' : '创建：UBS-档案-') + (args.fresh ? (subjectName ? '：' + subjectName : '') : args.characterName));
  const showUpdateSelect = async (): Promise<void> => {
    try {
      const status = await service.scanCharacterWorldbook(args.characterName);
      const candidates = status.hits.length ? `<label>选择要更新的条目<select data-char-worldbook-update-uid>${status.hits.map(hit => `<option value="${hit.uid}">${escapeHtml(hit.name || String(hit.uid))}</option>`).join('')}</select></label>` : '<p class="char-worldbook-error">主世界书中没有名称或关键词关联该角色的条目，无法更新。</p>';
      render(status.hits.length ? sourceForm(candidates) : candidates, '更新：' + args.characterName);
    } catch (error) { render(`<p class="char-worldbook-error">${escapeHtml(errorText(error))}</p>`, '更新角色世界书条目'); }
  };
  const showCreationReview = (): void => render(`<section class="char-worldbook-create-review"><p>AI 已生成草稿。可任意编辑；确认前不会写入世界书。</p><textarea data-char-worldbook-content>${escapeHtml(createdContent)}</textarea><div class="char-worldbook-review-actions"><button class="settings-action-btn" type="button" data-char-worldbook-final-confirm>确认写入主世界书</button><button class="settings-action-btn" type="button" data-char-worldbook-reject>拒绝并丢弃草稿</button></div></section>`);
  const CONTEXT_RADIUS = 120;
  const CONTEXT_MAX_LEN = 500;
  /** 取命中区间所在段落；占位符宏展开后的 old 也能定位到原文坐标（显示原文写法）。段落超长时前后各截 CONTEXT_RADIUS 字符加省略号。 */
  const diffContext = (originalContent: string, span: { start: number; end: number } | null): { text: string; start: number; end: number } | null => {
    if (!span) return null;
    const start = originalContent.lastIndexOf('\n', span.start) + 1;
    let end = originalContent.indexOf('\n', span.end);
    if (end === -1) end = originalContent.length;
    const spanLength = span.end - span.start;
    if (end - start <= CONTEXT_RADIUS * 2 + spanLength) {
      return { text: originalContent.slice(start, end), start: span.start - start, end: span.end - start };
    }
    const oldStart = span.start - start;
    const keepBefore = Math.min(CONTEXT_RADIUS, oldStart);
    const keepAfter = Math.min(CONTEXT_RADIUS, end - span.end);
    const before = originalContent.slice(start + oldStart - keepBefore, span.start);
    const after = originalContent.slice(span.end, span.end + keepAfter);
    const prefix = keepBefore < oldStart ? '…' : '';
    const suffix = span.end + keepAfter < end ? '…' : '';
    return {
      text: prefix + before + originalContent.slice(span.start, span.end) + after + suffix,
      start: prefix.length + before.length,
      end: prefix.length + before.length + spanLength,
    };
  };
  /** old→next 的 diff HTML：equal 段按 dimEqual 决定是否弱化，del 红删线，ins 绿加粗。 */
  const renderDiffHtml = (old: string, next: string, dimEqual = true): string => {
    try {
      return diffText(old, next).map(seg => {
        const text = escapeHtml(seg.text);
        if (seg.type === 'equal') return dimEqual ? `<span class="char-worldbook-diff-ctx">${text}</span>` : `<span>${text}</span>`;
        if (seg.type === 'del') return `<del>${text}</del>`;
        return `<ins>${text}</ins>`;
      }).join('');
    } catch { return `<del>${escapeHtml(old)}</del><ins>${escapeHtml(next)}</ins>`; }
  };
  /** 逐条结算结果（对原始内容跑一遍=预校验）：每条已勾选修改是否会写入及其原因。 */
  let reviewPlan: AppliedWorldbookChanges | null = null;
  const recomputePlan = (): AppliedWorldbookChanges | null => {
    reviewPlan = prepared ? applyApprovedWorldbookChanges(prepared.originalContent, changes) : null;
    return reviewPlan;
  };
  const mergeNoteText = (plan: AppliedWorldbookChanges): string => {
    if (!plan.outcomes.length) return '尚未勾选任何修改——勾选「通过」后才会写入。';
    if (!plan.applied) return `已勾选的 ${plan.outcomes.length} 条都无法写入：${plan.outcomes.map(item => item.error).join('；')}`;
    if (plan.failed) return `将写入 ${plan.applied} 条；另有 ${plan.failed} 条无法写入（见对应卡片标注）。`;
    return `已勾选 ${plan.applied} 条，全部可写入。`;
  };
  const setMergeNote = (text: string, isError = false): void => {
    const note = root.querySelector<HTMLElement>('[data-char-worldbook-merge-note]');
    if (!note) return;
    note.textContent = text;
    note.classList.toggle('is-error', isError);
    note.hidden = !text;
  };
  /** 勾选变化后重算结算结果：卡片警告 + 底部汇总 + 按钮可用性（只写节点，不重绘整页，避免丢滚动位置）。 */
  const refreshReviewState = (): void => {
    const plan = recomputePlan();
    if (!plan) return;
    root.querySelectorAll<HTMLElement>('[data-char-worldbook-change-warn]').forEach(node => {
      const outcome = plan.outcomes.find(item => item.index === Number(node.dataset.charWorldbookChangeWarn));
      const failed = outcome && !outcome.ok;
      node.textContent = failed ? `本条未写入：${outcome.error}` : '';
      node.hidden = !failed;
    });
    const blocked = !plan.applied;
    // 一条都没勾选只是提示（中性）；勾了却一条都写不进去才是错误（红）
    setMergeNote(mergeNoteText(plan), blocked && plan.outcomes.length > 0);
    const confirm = root.querySelector<HTMLButtonElement>('[data-char-worldbook-final-confirm]');
    if (confirm) confirm.disabled = blocked;
  };
  /** 单条修改卡片（diff 态）。 */
  const changeCard = (change: ApprovedWorldbookChange, index: number): string => {
    // old 可能是宏展开后的写法（AI 看到的是展开值）：定位回原文坐标，diff 左侧显示原文占位符，右侧同步还原占位符
    const located = prepared ? locateWorldbookChange(prepared.originalContent, change.old) : null;
    const rawOld = located?.raw ?? change.old;
    const nextText = restoreMacroTokens(change.next, located?.macros || []);
    const delChars = [...rawOld].length;
    const insChars = [...nextText].length;
    const outcome = reviewPlan?.outcomes.find(item => item.index === index);
    const failed = !!outcome && !outcome.ok;
    const warning = `<p class="char-worldbook-warn" data-char-worldbook-change-warn="${index}"${failed ? '' : ' hidden'}>${failed ? `本条未写入：${escapeHtml(outcome!.error)}` : ''}</p>`;
    const context = prepared ? diffContext(prepared.originalContent, located) : null;
    const diffBlock = context !== null && context.text.length <= CONTEXT_MAX_LEN
      ? renderDiffHtml(context.text, context.text.slice(0, context.start) + nextText + context.text.slice(context.end), true)
      : renderDiffHtml(rawOld, nextText, false);
    const approved = change.approved ? ' is-approved' : '';
    return `<article class="char-worldbook-change${approved}" data-char-worldbook-change-card="${index}"><header><span>修改 ${index + 1}</span><span class="char-worldbook-stats">−${delChars}字 +${insChars}字</span><label><input type="checkbox" data-char-worldbook-change-approve="${index}"${change.approved ? ' checked' : ''}> 通过</label></header>${warning}<div class="char-worldbook-diff">${diffBlock}</div><p class="char-worldbook-reason">依据：${escapeHtml(change.reason)}</p><button class="settings-action-btn" type="button" data-char-worldbook-change-edit="${index}">编辑替换文本</button></article>`;
  };
  /** 单条修改卡片（编辑态）。 */
  const changeCardEditing = (change: ApprovedWorldbookChange, index: number): string => `<article class="char-worldbook-change is-editing" data-char-worldbook-change-card="${index}"><header><span>修改 ${index + 1}</span></header><label>替换为<textarea data-char-worldbook-change-new="${index}">${escapeHtml(change.next)}</textarea></label><div class="char-worldbook-review-actions"><button class="settings-action-btn" type="button" data-char-worldbook-change-done="${index}">完成</button><button class="settings-action-btn" type="button" data-char-worldbook-change-cancel="${index}">取消</button></div></article>`;
  const editing = new Set<number>();
  const showUpdateReview = (): void => {
    recomputePlan();
    const resumeHint = resumedTask ? '关闭本窗口不会丢弃草稿，可从「更新已有条目」继续；要丢弃请点「放弃本次修改」。' : '';
    render(`<section class="char-worldbook-update-review"><p>逐条审核：红字删除线=将删除，绿字加粗=将写入；点「编辑替换文本」可手动修改替换内容，勾选「通过」后才会参与最终合并。合并按条结算：定位不到的条目会被跳过并标在卡片上，不影响其它条目。${resumeHint}</p>${changes.map((change, index) => (editing.has(index) ? changeCardEditing(change, index) : changeCard(change, index))).join('')}<p class="char-worldbook-merge-note" data-char-worldbook-merge-note hidden></p><div class="char-worldbook-review-actions"><button class="settings-action-btn" type="button" data-char-worldbook-discard>放弃本次修改</button><button class="settings-action-btn" type="button" data-char-worldbook-final-confirm>合并已通过修改并写入</button></div></section>`);
    refreshReviewState();
  };
  root.addEventListener('click', async event => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-char-worldbook-close]')) { close(); return; }
    const poolRoll = target.closest<HTMLElement>('[data-char-worldbook-pool-roll]');
    if (poolRoll && poolState) {
      const kind = poolRoll.dataset.charWorldbookPoolRoll as PoolKind;
      const count = Number(root.querySelector<HTMLInputElement>(`[data-char-worldbook-pool-count="${kind}"]`)?.value || 3);
      const isPersonality = kind === 'personality';
      if (isPersonality) poolState.personalityCount = count; else poolState.nsfwCount = count;
      const pool = isPersonality ? PERSONALITY_TRAIT_POOL : NSFW_TRAIT_POOL;
      const current = isPersonality ? poolState.personalityTags : poolState.nsfwTags;
      const picked = pickRandomTraitTags(pool, count, current);
      if (isPersonality) poolState.personalityTags = picked; else poolState.nsfwTags = picked;
      persistPool();
      refreshPoolSection(kind);
      return;
    }
    const poolClear = target.closest<HTMLElement>('[data-char-worldbook-pool-clear]');
    if (poolClear && poolState) {
      const kind = poolClear.dataset.charWorldbookPoolClear as PoolKind;
      if (kind === 'personality') poolState.personalityTags = []; else poolState.nsfwTags = [];
      persistPool();
      refreshPoolSection(kind);
      return;
    }
    const poolRemove = target.closest<HTMLElement>('[data-char-worldbook-pool-remove]');
    if (poolRemove && poolState) {
      const kind = poolRemove.dataset.charWorldbookPoolRemove as PoolKind;
      const tag = poolRemove.dataset.tag || '';
      if (kind === 'personality') poolState.personalityTags = poolState.personalityTags.filter(item => item !== tag);
      else poolState.nsfwTags = poolState.nsfwTags.filter(item => item !== tag);
      persistPool();
      refreshPoolSection(kind);
      return;
    }
    const editBtn = target.closest('[data-char-worldbook-change-edit]') as HTMLElement | null;
    if (editBtn) {
      const index = Number(editBtn.dataset.charWorldbookChangeEdit);
      const card = root.querySelector<HTMLElement>(`[data-char-worldbook-change-card="${index}"]`);
      const change = changes[index];
      if (change && card) { editing.add(index); card.outerHTML = changeCardEditing(change, index); }
      return;
    }
    const doneBtn = target.closest('[data-char-worldbook-change-done]') as HTMLElement | null;
    if (doneBtn) {
      const index = Number(doneBtn.dataset.charWorldbookChangeDone);
      const card = root.querySelector<HTMLElement>(`[data-char-worldbook-change-card="${index}"]`);
      const change = changes[index];
      if (change && card) {
        change.next = root.querySelector<HTMLTextAreaElement>(`[data-char-worldbook-change-new="${index}"]`)?.value ?? change.next;
        editing.delete(index);
        card.outerHTML = changeCard(change, index);
        refreshReviewState();
      }
      return;
    }
    const cancelBtn = target.closest('[data-char-worldbook-change-cancel]') as HTMLElement | null;
    if (cancelBtn) {
      const index = Number(cancelBtn.dataset.charWorldbookChangeCancel);
      const card = root.querySelector<HTMLElement>(`[data-char-worldbook-change-card="${index}"]`);
      if (changes[index] && card) { editing.delete(index); card.outerHTML = changeCard(changes[index], index); refreshReviewState(); }
      return;
    }
    if (target.closest('[data-char-worldbook-generate]')) {
      const count = Number(root.querySelector<HTMLInputElement>('[data-char-worldbook-count]')?.value || 20);
      const extra = root.querySelector<HTMLTextAreaElement>('[data-char-worldbook-extra]')?.value || '';
      const updateUid = Number(root.querySelector<HTMLSelectElement>('[data-char-worldbook-update-uid]')?.value);
      const templateId = root.querySelector<HTMLSelectElement>('[data-char-worldbook-template]')?.value || activeTemplate?.id || '';
      const creationTemplate = library?.templates.find(item => item.id === templateId) || activeTemplate;
      if (args.mode === 'create' && !creationTemplate) {
        render('<p class="char-worldbook-error">未找到可用的创建模板</p><button class="settings-action-btn" type="button" data-char-worldbook-back>返回</button>');
        return;
      }
      if (args.fresh) {
        const inputName = (root.querySelector<HTMLInputElement>('[data-char-worldbook-name]')?.value || '').trim();
        if (!inputName) { getToastr()?.error('请先填写新人物的姓名', '新人物创建'); return; }
        if (readRosterNames().has(inputName)) { getToastr()?.error('该姓名已存在于恋爱对象表/重要角色表，请在对应角色详情里创建世界书', '新人物创建'); return; }
        if (listPendingEncounters([]).includes(inputName)) { getToastr()?.error('该人物已在待相遇名单中', '新人物创建'); return; }
        subjectName = inputName;
      }
      // 特质池随取材一并冻结进后台任务，审核/恢复期间改池不影响本次生成
      const frozenPool = poolState && (poolState.personalityTags.length || poolState.nsfwTags.length)
        ? { personality: [...poolState.personalityTags], nsfw: [...poolState.nsfwTags] }
        : null;
      const started = startCharacterWorldbookBackgroundTask(taskMode, subjectName, async (): Promise<CharacterWorldbookBackgroundPayload> => {
        const frozenSnapshot = args.fresh
          ? await service.buildFreshCharacterWorldbookSnapshot(subjectName, count, extra)
          : await service.buildCharacterWorldbookSnapshot(subjectName, count, extra);
        frozenSnapshot.traitPool = frozenPool;
        if (args.mode === 'create') {
          const result = await requestCharacterWorldbookCreation(frozenSnapshot, creationTemplate!.body);
          return { snapshot: frozenSnapshot, prepared: null, createdContent: wrapCharacterWorldbookContent(frozenSnapshot.characterName, result.content), changes: [] };
        }
        const update = await service.prepareCharacterWorldbookUpdate(subjectName, updateUid);
        const result = await requestCharacterWorldbookUpdate(frozenSnapshot, update.originalContent, { uid: update.uid });
        return { snapshot: frozenSnapshot, prepared: update, createdContent: '', changes: result.changes.map(change => ({ ...change, approved: false })) };
      }, () => {
        getToastr()?.success(args.fresh ? '新人物档案已生成，已打开审核界面' : '生成完成，已打开审核界面', '角色世界书');
        showCharacterWorldbookDialog(args);
      }, error => {
        getToastr()?.error(errorText(error), '角色世界书');
        if (root.isConnected) render(`<p class="char-worldbook-error">${escapeHtml(errorText(error))}</p><button class="settings-action-btn" type="button" data-char-worldbook-back>返回</button>`);
      });
      if (!started) {
        render('<p class="char-worldbook-error">已有角色世界书任务正在生成或等待审核，请先完成该任务。</p>');
        return;
      }
      render('<p>正在冻结资料并请求 AI。你可以关闭此界面，任务会在后台继续生成；完成后将自动打开审核界面。</p>');
      return;
    }
    if (target.closest('[data-char-worldbook-back]')) { if (args.mode === 'create') showCreate(); else void showUpdateSelect(); return; }
    if (target.closest('[data-char-worldbook-reject]')) {
      if (resumedTask) clearCharacterWorldbookBackgroundTask();
      getToastr()?.info('已丢弃本次角色世界书草稿，未写入世界书', '角色世界书');
      close();
      return;
    }
    if (target.closest('[data-char-worldbook-discard]')) {
      if (resumedTask) clearCharacterWorldbookBackgroundTask();
      getToastr()?.info('已放弃本次修改，未写入世界书', '角色世界书');
      args.onCommitted(); close();
      return;
    }
    if (target.closest('[data-char-worldbook-final-confirm]')) {
      // 更新模式：按条结算，定位不到的条目跳过并留在页面上（不再整批失败、不再走 toastr，
      // 报错常驻页内以免 toast 叠在弹窗顶部把「通过」勾选框压住）
      if (args.mode !== 'create') {
        if (!prepared) { setMergeNote('更新审核状态已失效，请重新生成', true); return; }
        const plan = applyApprovedWorldbookChanges(prepared.originalContent, changes);
        if (!plan.applied) { setMergeNote(mergeNoteText(plan), true); return; }
        try {
          await service.commitCharacterWorldbookChanges(prepared, plan.content);
        } catch (error) { setMergeNote(errorText(error), true); return; }
        if (resumedTask) clearCharacterWorldbookBackgroundTask();
        if (plan.failed) getToastr()?.warning(`已写入 ${plan.applied} 条修改；${plan.failed} 条因原文无法唯一定位被跳过`, '角色世界书');
        else getToastr()?.success(`已写入 ${plan.applied} 条修改`, '角色世界书');
        args.onCommitted(); close();
        return;
      }
      try {
        const content = root.querySelector<HTMLTextAreaElement>('[data-char-worldbook-content]')?.value.trim() || '';
        if (!content) throw new Error('世界书条目内容不能为空');
        await service.createCharacterWorldbookEntry(subjectName, content, {}, resumedTask?.value?.snapshot.primaryName);
        if (args.fresh) {
          commitPendingEncounter(subjectName);
          getToastr()?.success(`「${subjectName}」已加入世界书，TA 正在故事里等待与主角相遇`, '新人物创建');
        }
        if (resumedTask) clearCharacterWorldbookBackgroundTask();
        args.onCommitted(); close();
      } catch (error) { getToastr()?.error(errorText(error), '角色世界书'); }
    }
  });
  root.addEventListener('change', event => {
    const input = event.target as HTMLInputElement;
    if (input.matches('[data-char-worldbook-pool-count]') && poolState) {
      const kind = (input.dataset.charWorldbookPoolCount || 'personality') as PoolKind;
      const value = Number(input.value);
      if (kind === 'personality') poolState.personalityCount = value; else poolState.nsfwCount = value;
      persistPool();
      return;
    }
    if (!input.matches('[data-char-worldbook-change-approve]')) return;
    const index = Number(input.dataset.charWorldbookChangeApprove);
    const change = changes[index];
    if (!change) return;
    change.approved = input.checked;
    input.closest('.char-worldbook-change')?.classList.toggle('is-approved', input.checked);
    refreshReviewState();
  });
  if (resumedTask) {
    if (args.mode === 'create') showCreationReview(); else showUpdateReview();
  } else if (activeTask) {
    render(`<p>角色“${escapeHtml(activeTask.characterName)}”的世界书任务正在后台继续生成或等待审核。请先完成该任务。</p>`);
  } else if (args.mode === 'create') showCreate(); else void showUpdateSelect();
}
