// ===== 角色中枢弹窗：固定窗口外壳 + 局部内容切换 =====
import { ubIcon } from '../core/icons';
import type { StyleType } from '../core/constants';
import { getInitials, getSheetByName, updateCell } from '../core/data-manager';
import { missingTableRepairHint } from '../core/ledger-takeover';
import { escapeHtml, escapeHtmlAttr } from '../core/html-escape';
import {
  buildCharacterHubRoster,
  buildProtagonistRecord,
  buildStoryChronicle,
  parseMilestoneEvents,
  parseWarningComparison,
  removeMilestoneEvent,
  type CharacterHubRecord,
  type MilestoneEntry,
  type PersonalityEntry,
  type PersonalityTrait,
  type ProtagonistRecord,
  type IntimacyRecord,
  type NsfwArchive,
  type StoryChronicle,
} from '../core/character-hub-model';
import { relationsOfCharacter, parseCharacterRelationRows, buildCharacterRelationGraph, parseProtagonistAttitude, relationCategoryClass, type CharacterRelation, type RelationCategory } from '../core/character-relation-model';
import { showCharacterRelationGraphPopup } from './character-relation-graph-popup';
import { parsePastExperience } from '../core/past-experience-parser';
import { isInvestigating } from '../core/investigation';
import { isInterviewing } from '../core/interview';
import { getToastr } from '../core/env';
import { showPortraitGalleryPopup } from './portrait-panel';
import { showChronicleReaderPopup } from './chronicle-reader-popup';
import { createDefaultCharacterWorldbookService } from '../core/character-worldbook';
import { showCharacterWorldbookDialog } from './character-worldbook-dialog';
import { dropPendingEncounter, listPendingEncounters } from '../core/character-pending-encounter';
import { showConfirmDialog } from './confirm-dialog';
import { bridgeWindowClass, closePanelOverlayOrReturn, guardGhostClick, markPopupShown, syncDarkClass, syncDarkClassMinimal } from './html-builder';
import { bindLongPressDelegated } from './long-press';

export interface CharacterHubPopupArgs {
  style: StyleType;
  initialCharacter?: string;
  openPastExperience: (name: string, onClosed: () => void) => void;
  openInvestigation: (name: string, btn: HTMLButtonElement, onClosed: () => void) => void;
  openInvestigationExtraPrompt: (name: string, btn: HTMLButtonElement, onClosed: () => void) => void;
  openInterview: (name: string, btn: HTMLButtonElement, onClosed: () => void) => void;
  investigationEnabled: boolean;
  interviewEnabled: boolean;
}

type DirectoryFilter = 'all' | 'romance' | 'important';
type HubPage = 'profile' | 'relationship' | 'personality' | 'intimacy' | 'milestone';

function titleForStyle(style: StyleType): string {
  if (style === 'minimal') return 'CHARACTER ARCHIVE';
  if (style === 'ancient') return '人物谱';
  if (style === 'xianxia') return '仙缘簿';
  if (style === 'bridge') return '人员档案';
  return '角色中枢';
}

function leadMoreLabel(style: StyleType): string {
  if (style === 'minimal') return 'VIEW PROFILE →';
  if (style === 'ancient' || style === 'xianxia') return '查阅其人 →';
  if (style === 'bridge') return 'OPEN FILE →';
  return '查看档案 →';
}

const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
function cnDigits(value: string): string {
  return value.split('').map(ch => CN_NUM[Number(ch)] ?? ch).join('');
}
function cnMonthDay(m: string, d: string): string {
  const mm = Number(m), dd = Number(d);
  const tens = ['零', '十', '二十', '三十'];
  const num = (n: number): string => n < 10 ? CN_NUM[n] : n < 20 ? '十' + (n % 10 ? CN_NUM[n % 10] : '') : tens[Math.floor(n / 10)] + (n % 10 ? CN_NUM[n % 10] : '');
  return `${num(mm)}月${num(dd)}日`;
}
const EN_MONTH = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function formatMilestoneDate(entry: { dateParts: { y: string; m: string; d: string } | null }, style: StyleType): string {
  const p = entry.dateParts;
  if (!p) return '';
  if (style === 'ancient' || style === 'xianxia') return `${cnDigits(p.y)} · ${cnMonthDay(p.m, p.d)}`;
  if (style === 'minimal') return `${p.m}.${p.d}`;
  if (style === 'bridge') return `${p.y}-${p.m}-${p.d}`;
  return `${p.y}.${p.m}.${p.d}`;
}

// ===== 故事编年史（全员里程碑聚合视图）=====

/** 角色色点：姓名散列出稳定色相，全主题可读的固定明度。 */
function charHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return hash % 360;
}

function charDot(name: string): string {
  return `<span class="char-hub-cr-dot" style="background:hsl(${charHue(name)},70%,58%)"></span>`;
}

function chronicleBannerTitle(style: StyleType): string {
  if (style === 'minimal') return 'CHRONICLE';
  if (style === 'bridge') return 'STORY CHRONICLE';
  if (style === 'ancient') return '众人编年';
  if (style === 'xianxia') return '岁月共历';
  return '故事编年史';
}

function chronicleStatsLabel(data: StoryChronicle): string {
  return [`${data.eventCount} 枚印记`, `${data.characterCount} 位角色`, data.spanDays > 0 ? `历 ${data.spanDays} 天` : '']
    .filter(Boolean).join(' · ');
}

function chronicleHeroLabel(data: StoryChronicle, style: StyleType): string {
  if (style === 'bridge') return `EVENTS · ${data.characterCount} PEOPLE${data.spanDays > 0 ? ` · DAY 001—${String(data.spanDays + 1).padStart(3, '0')}` : ''}`;
  if (style === 'minimal') return `ENTRIES · ${data.characterCount} PEOPLE${data.spanDays > 0 ? ` · ${data.spanDays} DAYS` : ''}`;
  return chronicleStatsLabel(data);
}

function chroniclePage(data: StoryChronicle, style: StyleType): string {
  if (!data.eventCount) return `<div class="char-hub-chronicle">${empty('暂无可编年的里程碑')}</div>`;
  const charNames: string[] = [];
  for (const day of data.days) {
    for (const ev of day.events) if (!charNames.includes(ev.name)) charNames.push(ev.name);
  }
  const chips = charNames.length > 1
    ? `<div class="char-hub-cr-chips" role="tablist"><button class="char-hub-cr-chip active" data-char-hub-cr-chip="all" type="button">全部</button>${charNames.map(name => `<button class="char-hub-cr-chip" data-char-hub-cr-chip="${escapeHtmlAttr(name)}" type="button">${charDot(name)}${escapeHtml(name)}</button>`).join('')}</div>`
    : '';
  const dayList = data.days.map(day => {
    const p = day.dateParts;
    const events = day.events.map(ev => {
      const catClass = ev.category === '初体验' ? 'is-first' : ev.category === '关系' ? 'is-relation' : ev.category === '状况' ? 'is-status' : '';
      const cat = catClass ? `<span class="char-hub-ms-cat ${catClass}">${escapeHtml(ev.category || '')}</span>` : '';
      return `<p class="char-hub-cr-event" data-char-hub-cr-char="${escapeHtmlAttr(ev.name)}">${charDot(ev.name)}<b class="char-hub-cr-name">${escapeHtml(ev.name)}</b>${cat}${escapeHtml(ev.description)}</p>`;
    }).join('');
    const dateHtml = `<time class="char-hub-ms-date">${escapeHtml(formatMilestoneDate({ dateParts: p }, style))}<small>${day.events.length} 条印记</small></time>`;
    return `<li class="char-hub-cr-day" data-char-hub-cr-day><button class="char-hub-ms-node" type="button" data-char-hub-cr-jump="${escapeHtmlAttr(day.dateKey)}" aria-label="回看 ${escapeHtmlAttr(day.dateKey)} 的剧情回顾"><span>${Number(p.m)}.${Number(p.d)}</span></button>${dateHtml}<div class="char-hub-cr-events">${events}</div></li>`;
  }).join('');
  const undated = data.undated.length
    ? `<section class="char-hub-cr-undated"><span class="char-hub-section-kicker">未注明日期</span>${data.undated.map(ev => `<p>${escapeHtml(ev.raw || ev.description)}</p>`).join('')}</section>`
    : '';
  return `<div class="char-hub-chronicle"><div class="char-hub-back-row"><button class="char-hub-back" data-char-hub-back type="button"><span aria-hidden="true">←</span> 返回人物目录</button></div><div class="char-hub-ms-hero"><b>${data.eventCount}</b><small>${escapeHtml(chronicleHeroLabel(data, style))}</small></div>${chips}<ol class="char-hub-ms-list char-hub-cr-list">${dayList}</ol><p class="char-hub-ms-hint">点击日期回看当日剧情回顾</p>${undated}</div>`;
}

/** U40：civilDays/dayDiff 已迁 core/date-math 单源；此处 re-export 保持既有测试与调用方引用不变。 */
import { dateKeyDayDiff as dayDiff } from '../core/date-math';
export { dayDiff };

function milestoneHeroHtml(record: CharacterHubRecord, style: StyleType): string {
  const entries = record.milestones;
  const parsed = entries.filter(e => e.dateParts);
  if (!entries.length || !parsed.length) return '';
  const days = dayDiff(parsed[0].dateKey, parsed[parsed.length - 1].dateKey);
  const label = (() => {
    switch (style) {
      case 'bridge': return days > 0 ? `EVENTS · DAY 001—${String(days).padStart(3, '0')}` : 'EVENTS';
      case 'minimal': return days > 0 ? `ENTRIES · ${days} DAYS` : 'ENTRIES';
      case 'ancient': return days > 0 ? `枚人生印记 · 历 ${days} 天` : '枚人生印记';
      case 'xianxia': return days > 0 ? `枚星标 · 历 ${days} 天` : '枚星标';
      case 'sweet': return days > 0 ? `枚邮戳 · 历 ${days} 天` : '枚邮戳';
      case 'ios': return days > 0 ? `个足迹 · 历 ${days} 天` : '个足迹';
      default: return days > 0 ? `次心动 · 历 ${days} 天` : '次心动';
    }
  })();
  return `<div class="char-hub-ms-hero"><b>${entries.length}</b><small>${escapeHtml(label)}</small></div>`;
}

function protagonistLabel(style: StyleType): string {
  if (style === 'bridge') return 'CAPTAIN · 主角';
  if (style === 'minimal' || style === 'flirtatious' || style === 'sweet') return 'PROTAGONIST · 主角';
  return '主角';
}

function appendHtml(parent: Element, html: string): void {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  parent.append(template.content);
}

function replaceHtml(parent: Element, html: string): void {
  parent.replaceChildren();
  appendHtml(parent, html);
}

function portrait(record: CharacterHubRecord, lazy = false): string {
  // 懒加载只给目录网格卡（多图同开）；详情页头是主图，按图库先例保持急加载。
  if (record.portraitPath) return `<img src="${escapeHtmlAttr(record.portraitPath)}" alt="${escapeHtmlAttr(record.name)}"${lazy ? ' loading="lazy" decoding="async"' : ''}>`;
  return `<span class="char-hub-initial">${escapeHtml(getInitials(record.name))}</span>`;
}

function traitCard(entry: PersonalityTrait): string {
  if (entry.raw) return `<article class="char-hub-trait char-hub-raw">${escapeHtml(entry.raw)}</article>`;
  return `<article class="char-hub-trait"><b>${escapeHtml(entry.trait || '')}</b><span>${escapeHtml(entry.detail || '')}</span></article>`;
}

function logicCard(entry: PersonalityEntry, index: number): string {
  if (entry.raw) return `<article class="char-hub-logic char-hub-raw"><span class="char-hub-logic-index">${String(index + 1).padStart(2, '0')}</span><p>${escapeHtml(entry.raw)}</p></article>`;
  return `<article class="char-hub-logic"><span class="char-hub-logic-index">${String(index + 1).padStart(2, '0')}</span><div class="char-hub-logic-copy"><b>${escapeHtml(entry.title || '')}</b><p>${escapeHtml(entry.meaning || '')}</p>${entry.guard ? `<small><i aria-hidden="true">!</i><span>避免误读</span>${escapeHtml(entry.guard)}</small>` : ''}</div></article>`;
}

function empty(text: string): string { return `<div class="panel-empty">${escapeHtml(text)}</div>`; }

function renderGender(gender: string): string {
  const g = String(gender || '').trim();
  if (!g) return '';
  if (/女|female|♀/i.test(g)) return '<span class="char-hub-gsym is-female">♀<small>女</small></span>';
  if (/男|male|♂/i.test(g)) return '<span class="char-hub-gsym is-male">♂<small>男</small></span>';
  return escapeHtml(g);
}

function proseCard(label: string, text: string, extraClass = ''): string {
  if (!text.trim()) return '';
  return `<section class="char-hub-prose-card${extraClass ? ` ${extraClass}` : ''}"><span class="char-hub-section-kicker">${escapeHtml(label)}</span><p>${escapeHtml(text)}</p></section>`;
}

function vitalsCell(num: string, unit: string, lab: string, cup = ''): string {
  const cupHtml = cup ? `<em class="char-hub-vitals-cup">${escapeHtml(cup)}</em>` : '';
  const unitHtml = unit ? `<small class="char-hub-vitals-unit">${escapeHtml(unit)}</small>` : '';
  return `<span class="char-hub-vitals-cell"><b class="char-hub-vitals-num">${escapeHtml(num)}${cupHtml}${unitHtml}</b><small class="char-hub-vitals-lab">${escapeHtml(lab)}</small></span>`;
}

function vitalsHtml(nsfw: NsfwArchive | null): string {
  if (!nsfw) return '';
  const raws: string[] = [];
  const rows: string[] = [];
  if (nsfw.vitals) {
    if (nsfw.vitals.rawHeightWeight) {
      raws.push(`<span class="char-hub-vitals-raw">${escapeHtml(nsfw.vitals.rawHeightWeight)}</span>`);
    } else {
      const hw: string[] = [];
      if (nsfw.vitals.heightCm) hw.push(vitalsCell(nsfw.vitals.heightCm, 'cm', '身高'));
      if (nsfw.vitals.weightKg) hw.push(vitalsCell(nsfw.vitals.weightKg, 'kg', '体重'));
      if (hw.length) rows.push(`<div class="char-hub-vitals-row">${hw.join('<i class="char-hub-vitals-sep" aria-hidden="true"></i>')}</div>`);
    }
  }
  if (nsfw.measurements) {
    if (nsfw.measurements.rawMeasurements) {
      raws.push(`<span class="char-hub-vitals-raw">${escapeHtml(nsfw.measurements.rawMeasurements)}</span>`);
    } else {
      const fig: Array<{ num: string; lab: string; cup: string }> = [];
      if (nsfw.measurements.bust) fig.push({ num: String(nsfw.measurements.bust), lab: 'B 胸围', cup: nsfw.measurements.cup || '' });
      if (nsfw.measurements.waist) fig.push({ num: String(nsfw.measurements.waist), lab: 'W 腰围', cup: '' });
      if (nsfw.measurements.hip) fig.push({ num: String(nsfw.measurements.hip), lab: 'H 臀围', cup: '' });
      if (fig.length) {
        // 三围读作一个整体值（86-58-88）：破折号连体，cm 单位只标在末位
        const cells = fig.map((item, index) => vitalsCell(item.num, index === fig.length - 1 ? 'cm' : '', item.lab, item.cup));
        const looseCup = !nsfw.measurements.bust && nsfw.measurements.cup ? `<em class="char-hub-vitals-cup is-loose">${escapeHtml(nsfw.measurements.cup)}</em>` : '';
        rows.push(`<div class="char-hub-vitals-row">${cells.join('<i class="char-hub-vitals-dash" aria-hidden="true"></i>')}${looseCup}</div>`);
      }
    }
  }
  if (!raws.length && !rows.length) return '';
  const desc = [nsfw.vitals?.heightWeightDesc, nsfw.measurements?.measurementsDesc].filter(Boolean).join('；');
  const strip = rows.length ? `<div class="char-hub-vitals-strip">${rows.join('')}</div>` : '';
  return `<div class="char-hub-vitals">${strip}${raws.join('')}${desc ? `<p class="char-hub-vitals-desc">${escapeHtml(desc)}</p>` : ''}</div>`;
}

function speechContrastHtml(speechStyle: string, voiceStyle: string): string {
  if (!speechStyle && !voiceStyle) return '';
  const day = speechStyle
    ? `<div class="char-hub-speech-day"><span class="char-hub-speech-kicker">☀ 日常 · 口癖</span><p>${escapeHtml(speechStyle)}</p></div>`
    : '';
  const night = voiceStyle
    ? `<div class="char-hub-speech-night"><span class="char-hub-speech-kicker">☾ 床上 · 淫语</span><p>${escapeHtml(voiceStyle)}</p></div>`
    : '';
  return `<div class="char-hub-speech">${day}${night}</div>`;
}

function addressChip(nsfw: NsfwArchive | null): string {
  if (!nsfw?.addressProtagonist) return '';
  return `<span class="char-hub-address">称呼你：${escapeHtml(nsfw.addressProtagonist)}</span>`;
}

function trainingTier(value: number): string {
  if (value < 100) return '初识';
  if (value < 300) return '浅尝';
  if (value < 600) return '渐入佳境';
  if (value < 850) return '深陷';
  return '臣服';
}

function dualStatHero(nsfw: NsfwArchive | null, intimacy: IntimacyRecord | null): string {
  const tv = nsfw?.trainingValue ?? null;
  const count = intimacy?.sexCount;
  if (tv === null && !count) return '';
  const left = tv !== null
    ? `<div class="char-hub-stat char-hub-stat--train"><b class="char-hub-stat-num">${tv}<small> / 1000</small></b><div class="char-hub-stat-meta"><span class="char-hub-stat-tier">调教 · ${trainingTier(tv)}</span><span class="char-hub-stat-bar"><span class="char-hub-stat-fill" style="width:${(tv / 1000 * 100).toFixed(1)}%"></span></span><span class="char-hub-stat-pct">${(tv / 10).toFixed(0)}% · 只升不降</span></div></div>`
    : '';
  const right = count
    ? `<div class="char-hub-stat char-hub-stat--count"><b class="char-hub-stat-num">${escapeHtml(count)}</b><small class="char-hub-stat-unit">次</small><span class="char-hub-stat-tier">累计亲密次数</span></div>`
    : '';
  return `<div class="char-hub-dual-stat">${left}${right}</div>`;
}

function nsfwProseCard(kicker: string, text: string, wide = false): string {
  if (!text.trim()) return '';
  return `<article class="char-hub-nsfw-card${wide ? ' is-wide' : ''}"><span class="char-hub-section-kicker">${escapeHtml(kicker)}</span><p>${escapeHtml(text)}</p></article>`;
}

function profilePage(record: CharacterHubRecord): string {
  const facts = [
    record.gender ? `<span><small>性别</small><b>${renderGender(record.gender)}</b></span>` : '',
    record.birthday ? `<span><small>生日</small><b>${escapeHtml(record.birthday)}</b></span>` : '',
    record.age ? `<span><small>年龄</small><b>${escapeHtml(record.age)}</b></span>` : '',
    `<span><small>归档</small><b>${record.kind === 'romance' ? '恋爱对象' : '重要角色'}</b></span>`,
  ].filter(Boolean).join('');
  const lede = record.briefIntro
    ? `<blockquote class="char-hub-profile-lede"><span aria-hidden="true">“</span><p>${escapeHtml(record.briefIntro)}</p></blockquote>`
    : '';
  const vitals = vitalsHtml(record.nsfw);
  const bodyFeatures = record.nsfw?.bodyFeatures ? proseCard('身材与特异性征', record.nsfw.bodyFeatures, 'is-wide') : '';
  const prose = [
    proseCard('外貌印象', record.appearance, 'is-wide'),
    bodyFeatures,
    proseCard('身份侧写', record.identity),
  ].join('');
  const speech = speechContrastHtml(record.speechStyle, record.nsfw?.voiceStyle || '');
  return `<section class="char-hub-page char-hub-profile" data-char-hub-page="profile"><div class="char-hub-profile-facts">${facts}</div>${vitals}${lede}<div class="char-hub-profile-prose">${prose || empty('暂无更多人物档案')}</div>${speech}<section class="char-hub-worldbook" data-char-hub-worldbook="${escapeHtmlAttr(record.name)}"><header><span class="char-hub-section-kicker">角色世界书</span><small>仅读取当前角色卡的主世界书</small></header><p class="char-hub-worldbook-loading">正在检查关联条目…</p></section></section>`;
}

function relationGraphTitle(style: StyleType): string {
  if (style === 'minimal') return 'RELATION WEB';
  if (style === 'bridge') return 'RELATION CHART';
  if (style === 'ancient') return '关系图谱';
  if (style === 'xianxia') return '因缘之网';
  return '人物关系网';
}

function relationCard(entry: { partner: string; category: string; relation: CharacterRelation }, linkable: boolean): string {
  const r = entry.relation;
  const avatar = `<span class="char-hub-relation-avatar">${escapeHtml(getInitials(entry.partner))}</span>`;
  const link = linkable
    ? `<button class="char-hub-related-link" data-char-hub-related="${escapeHtmlAttr(entry.partner)}" type="button">查看人物 <span aria-hidden="true">→</span></button>`
    : '<span class="char-hub-related-static" aria-hidden="true">—</span>';
  return `<article class="char-hub-relation-card cr-rel-card cat-${relationCategoryClass(entry.category as RelationCategory)}">${avatar}<div><b>${escapeHtml(entry.partner)}</b><i class="cr-rel-type">${escapeHtml(r.relationType || '关系')}</i>${r.currentStatus ? `<p>${escapeHtml(r.currentStatus)}</p>` : (r.mutualView ? `<p>${escapeHtml(r.mutualView)}</p>` : '')}</div>${link}</article>`;
}

function relationshipPage(record: CharacterHubRecord, roster: CharacterHubRecord[], relationRows: CharacterRelation[], rosterOrder: string[], relationTableMissing: boolean): string {
  const names = new Set(roster.map(item => item.name));
  // rosterOrder[0] 约定为主角名；主角缺失时它退化为首个角色名，此时不作主角语义使用
  const protagonistName = rosterOrder[0] && !names.has(rosterOrder[0]) ? rosterOrder[0] : '';
  // 表内关系（与主角的成对关系已迁往「对主角态度」列，遗留主角对不展示）
  const list = relationsOfCharacter(relationRows, record.name, rosterOrder, protagonistName);
  const cards = list.map(entry => relationCard(entry, !!entry.partner && entry.partner !== protagonistName && names.has(entry.partner))).join('');
  const relationBody = relationTableMissing
    ? empty(`当前聊天还没有「人物关系表」——请${missingTableRepairHint()}后使用`)
    : cards || empty('还没有记录在案的关系——当 TA 与其他人物同场互动并建立关系时，AI 填表会自动记录');
  const relationMap = `<section class="char-hub-relationship-map"><div class="char-hub-relationship-map-head"><span class="char-hub-section-kicker">人物关系</span><small>每对人物一条 · 来自人物关系表</small></div><div class="char-hub-relationship-self"><i aria-hidden="true"></i><b>${escapeHtml(record.name)}</b><span>当前人物</span></div><div class="char-hub-relation-grid">${relationBody}</div><button class="char-hub-graph-entry" data-char-hub-graph="${escapeHtmlAttr(record.name)}" type="button">在关系网中查看 <span aria-hidden="true">→</span></button></section>`;
  // 与主角的关系/态度：同一列两段拆分（关系：XX；态度：YY），关系段并入卡片标题
  const protagonistParsed = parseProtagonistAttitude(record.attitude);
  const cards2 = [
    proseCard(
      protagonistParsed.relation ? `与你的关系 · ${protagonistParsed.relation}` : '对你的态度',
      protagonistParsed.attitude || (protagonistParsed.relation ? `与主角是${protagonistParsed.relation}关系` : ''),
      'char-hub-relationship-attitude',
    ),
    proseCard('近期相处片段', record.recentInteraction, 'char-hub-relationship-recent'),
  ].join('');
  const past = parsePastExperience(record.pastExperience);
  const lastDay = past.days[past.days.length - 1];
  const lastEntry = lastDay?.entries[lastDay.entries.length - 1] || '';
  const historyParts = [
    past.intro ? `<article class="char-hub-history-background"><span class="char-hub-section-kicker">人物背景</span><p>${escapeHtml(past.intro)}</p></article>` : '',
    lastDay && lastEntry ? `<article class="char-hub-history-latest"><header><span class="char-hub-section-kicker">最近一页</span><time>${escapeHtml(lastDay.dateLabel)}</time></header><p>${escapeHtml(lastEntry)}</p></article>` : '',
  ].filter(Boolean).join('');
  const history = record.pastExperience
    ? `<aside class="char-hub-history-door"><div class="char-hub-history-head"><span class="char-hub-section-kicker">人物旧事</span><button class="char-hub-past-btn" data-char-hub-past="${escapeHtmlAttr(record.name)}" type="button">翻阅全部旧事 <span aria-hidden="true">→</span></button></div><div class="char-hub-history-preview">${historyParts}</div></aside>`
    : empty('暂无可展开的过往经历');
  return `<section class="char-hub-page char-hub-relationship" data-char-hub-page="relationship">${relationMap}<div class="char-hub-relationship-grid">${cards2}</div>${history}</section>`;
}

function personalityPage(record: CharacterHubRecord): string {
  const personality = record.personality;
  if (!personality) return `<section class="char-hub-page" data-char-hub-page="personality">${empty('暂无性格变化记录')}</section>`;
  const mood = personality.emotion
    ? `<aside class="char-hub-mood-note"><span class="char-hub-section-kicker">近期情绪底色</span><p>${escapeHtml(personality.emotion)}</p></aside>`
    : '';
  const interactions = personality.interactions.length
    ? `<section class="char-hub-personality-section"><header><span>01</span><div><small>与你相处时</small><h4>对主角的交互逻辑</h4></div></header><div class="char-hub-logic-list">${personality.interactions.map(logicCard).join('')}</div></section>`
    : '';
  const traits = personality.strengthened.length || personality.weakened.length
    ? `<section class="char-hub-personality-section"><header><span>02</span><div><small>性格重心迁移</small><h4>强化与弱化</h4></div></header><div class="char-hub-trait-balance"><div class="char-hub-trait-column is-strengthened"><h5><i>↑</i> 被强化</h5>${personality.strengthened.map(traitCard).join('') || empty('暂无')}</div><div class="char-hub-trait-column is-weakened"><h5><i>↓</i> 被弱化</h5>${personality.weakened.map(traitCard).join('') || empty('暂无')}</div></div></section>`
    : '';
  const behavior = personality.behavior.length
    ? `<section class="char-hub-personality-section"><header><span>03</span><div><small>外显行为改变</small><h4>行为模式变化</h4></div></header><div class="char-hub-logic-list">${personality.behavior.map(logicCard).join('')}</div></section>`
    : '';
  const warnings = personality.warnings?.length ? personality.warnings : [];
  const caution = warnings.length
    ? `<aside class="char-hub-caution"><header><span aria-hidden="true">◇</span><b>避免误读 · 禁止臆测</b></header><div class="char-hub-caution-list">${warnings.map(item => {
      const comparison = parseWarningComparison(item);
      return comparison
        ? `<div class="char-hub-not-equal"><span class="char-hub-not-equal-concept">${escapeHtml(comparison.left)}</span><span class="char-hub-not-equal-label"><b>≠</b><small>不可等同</small></span><span class="char-hub-not-equal-concept">${escapeHtml(comparison.right)}</span></div>`
        : `<p class="char-hub-caution-item">${escapeHtml(item)}</p>`;
    }).join('')}</div></aside>`
    : '';
  return `<section class="char-hub-page char-hub-personality" data-char-hub-page="personality">${mood}${interactions}${traits}${behavior}${caution}</section>`;
}

function intimacyPage(record: CharacterHubRecord): string {
  const nsfw = record.nsfw;
  const body = nsfw ? [
    nsfwProseCard('下体状态', nsfw.genitalsStatus),
    nsfwProseCard('后庭状态', nsfw.analStatus),
    nsfwProseCard('泌乳 / 体液', nsfw.lactationStatus, true),
  ].join('') : '';
  const pref = nsfw ? [
    nsfwProseCard('性爱接受度 · XP', nsfw.eroticDisposition, true),
    nsfwProseCard('性经验程度', nsfw.experienceLevel, true),
  ].join('') : '';
  const hero = dualStatHero(nsfw, record.intimacy);
  const slips = record.intimacy?.records.length
    ? record.intimacy.records.map((entry, index) => `<article class="char-hub-intimacy-slip${entry.ongoing ? ' is-ongoing' : ''}"><header><span>PRIVATE NOTE ${String(index + 1).padStart(2, '0')}</span>${entry.ongoing ? '<i>余韵未散</i>' : '<i>已归档</i>'}</header><time>${escapeHtml(entry.date || '未解析时间')}</time><p>${escapeHtml(entry.description)}</p></article>`).join('')
    : '';
  const bodySection = body ? `<section class="char-hub-nsfw-group"><h5 class="char-hub-nsfw-group-title"><span class="char-hub-nsfw-dot"></span>身体 · 生理基线</h5><div class="char-hub-nsfw-grid">${body}</div></section>` : '';
  const prefSection = pref ? `<section class="char-hub-nsfw-group"><h5 class="char-hub-nsfw-group-title is-pref"><span class="char-hub-nsfw-dot"></span>偏好 · 心理</h5><div class="char-hub-nsfw-grid">${pref}</div></section>` : '';
  const slipsSection = record.intimacy?.records.length
    ? `<section class="char-hub-nsfw-slips"><div class="char-hub-intimacy-caption"><span>最近性行为</span><small>仅保留最近两次记录</small></div>${slips}</section>`
    : '';
  if (!body && !pref && !hero && !slipsSection) {
    return `<section class="char-hub-page char-hub-intimacy" data-char-hub-page="intimacy">${empty('暂无亲密档案')}</section>`;
  }
  return `<section class="char-hub-page char-hub-intimacy" data-char-hub-page="intimacy">${bodySection}${prefSection}${hero}${slipsSection}</section>`;
}

const CN_ORDINALS = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾'];

function milestoneNodeLabel(entry: MilestoneEntry, style: StyleType, index: number): string {
  if (style === 'ancient') return CN_ORDINALS[index % 10];
  if (style === 'sweet') return '♥';
  if (style === 'minimal') return entry.dateParts ? `${entry.dateParts.m}.${entry.dateParts.d}` : '·';
  return String(index + 1);
}

function milestonePage(record: CharacterHubRecord, style: StyleType): string {
  const entries = record.milestones;
  if (!entries.length) return `<section class="char-hub-page" data-char-hub-page="milestone">${empty('暂无人生里程碑')}</section>`;
  let latestIdx = -1;
  entries.forEach((e, i) => { if (e.dateParts) latestIdx = i; });
  const items = entries.map((entry, index) => {
    const isLatest = index === latestIdx;
    const node = entry.raw
      ? `<i class="char-hub-ms-node is-raw" aria-hidden="true"><span>·</span></i>`
      : `<button class="char-hub-ms-node" type="button" data-char-hub-milestone="${escapeHtmlAttr(entry.dateKey)}" aria-label="回看 ${escapeHtmlAttr(record.name)} 的当日剧情回顾"><span>${escapeHtml(milestoneNodeLabel(entry, style, index))}</span></button>`;
    const p = entry.dateParts;
    const dateHtml = p
      ? `<time class="char-hub-ms-date">${escapeHtml(formatMilestoneDate(entry, style))}${style === 'minimal' ? `<small>${EN_MONTH[Number(p.m) - 1]} ${Number(p.d)}</small>` : style === 'bridge' ? `<small>LOG ${String(index + 1).padStart(2, '0')}</small>` : ''}</time>`
      : '';
    let desc: string;
    if (entry.raw) {
      desc = `<p class="char-hub-ms-desc is-raw">${escapeHtml(entry.raw)}</p>`;
    } else {
      const catClass = entry.category === '初体验' ? 'is-first' : entry.category === '关系' ? 'is-relation' : entry.category === '状况' ? 'is-status' : '';
      const cat = catClass ? `<span class="char-hub-ms-cat ${catClass}">${escapeHtml(entry.category || '')}</span>` : '';
      desc = `<p class="char-hub-ms-desc">${cat}${escapeHtml(entry.description)}</p>`;
    }
    return `<li class="char-hub-ms-item${isLatest ? ' is-latest' : ''}${entry.raw ? ' is-raw' : ''}">${node}${dateHtml}${desc}<button class="char-hub-ms-del" type="button" data-char-hub-ms-del="${index}" aria-label="删除这条里程碑事件" title="删除里程碑">&times;</button></li>`;
  }).join('');
  return `<section class="char-hub-page" data-char-hub-page="milestone">${milestoneHeroHtml(record, style)}<ol class="char-hub-ms-list">${items}</ol><p class="char-hub-ms-hint">点击条目回看当日剧情回顾</p></section>`;
}

function detailPage(record: CharacterHubRecord, page: HubPage, style: StyleType, roster: CharacterHubRecord[], relationRows: CharacterRelation[], rosterOrder: string[], relationTableMissing: boolean): string {
  if (page === 'profile') return profilePage(record);
  if (page === 'relationship') return relationshipPage(record, roster, relationRows, rosterOrder, relationTableMissing);
  if (page === 'personality') return personalityPage(record);
  if (page === 'milestone') return milestonePage(record, style);
  return intimacyPage(record);
}

function directoryCard(record: CharacterHubRecord): string {
  const searchable = `${record.name}\n${record.briefIntro}\n${record.identity}`.toLocaleLowerCase();
  return `<button class="char-hub-card" data-char-hub-open="${escapeHtmlAttr(record.name)}" data-char-hub-kind="${record.kind}" data-char-hub-searchable="${escapeHtmlAttr(searchable)}" type="button"><span class="char-hub-portrait">${portrait(record, true)}</span><span class="char-hub-card-copy"><b>${escapeHtml(record.name)}</b><small>${escapeHtml(record.kind === 'romance' ? '恋爱对象' : '重要角色')}</small><em>${escapeHtml(record.briefIntro || record.identity || '暂无简介')}</em></span></button>`;
}

export function showCharacterHubPopup(args: CharacterHubPopupArgs): void {
  const overlay = document.getElementById('panelOverlay');
  if (!overlay) return;
  let records = buildCharacterHubRoster();
  let activeFilter: DirectoryFilter = 'all';
  let searchDraft = '';
  let appliedSearch = '';
  let activePage: HubPage = 'profile';
  let activeRecord: CharacterHubRecord | null = null;
  let chronicleChar = 'all';
  let directoryScrollTop = 0;
  let detailScrollTop = 0;
  let worldbookScanToken = 0;
  const popupClass = args.style === 'bridge'
    ? `${bridgeWindowClass('character', 'l')} char-info-popup char-hub-popup`
    : 'panel-popup char-info-popup char-hub-popup ub-popup--l';

  if (args.style === 'minimal') syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  const root = document.createElement('div');
  root.className = `${popupClass} char-hub-theme-${args.style}`;
  appendHtml(root, `<div class="panel-popup-head"><div class="panel-popup-title">${titleForStyle(args.style)}</div><button class="panel-popup-close" id="panelClose" type="button">&times;</button></div><div class="char-hub-body"><div class="char-hub-no-instant-fields" hidden></div></div>`);
  const body = root.querySelector<HTMLElement>('.char-hub-body');
  if (!body) return;
  const directoryRoot = document.createElement('section');
  directoryRoot.className = 'char-hub-directory';
  const protagonist = buildProtagonistRecord();
  const relationSheet = getSheetByName('人物关系表');
  const relationRows = parseCharacterRelationRows(relationSheet);
  const rosterOrder = [protagonist?.name || '', ...records.map(r => r.name)].filter(Boolean);
  const relationGraph = buildCharacterRelationGraph(
    relationRows,
    records.map(r => ({ name: r.name, kind: r.kind, portraitPath: r.portraitPath, briefIntro: r.briefIntro || r.identity, attitudeCell: r.attitude })),
    protagonist ? { name: protagonist.name } : null,
  );
  const leadBannerHtml = protagonist
    ? `<button class="char-hub-lead-banner" data-char-hub-lead type="button"><b class="char-hub-lead-name">${escapeHtml(protagonist.name)}</b><span class="char-hub-lead-facts">${[renderGender(protagonist.gender), escapeHtml(protagonist.age), escapeHtml(protagonist.identity)].map(v => v ? `<i>${v}</i>` : '').join('')}</span><span class="char-hub-lead-more">${leadMoreLabel(args.style)}</span></button>`
    : '';
  const chronicleData = buildStoryChronicle(records);
  const chronicleBannerHtml = chronicleData.eventCount > 0
    ? `<button class="char-hub-lead-banner char-hub-cr-banner" data-char-hub-chronicle type="button"><b class="char-hub-lead-name">${escapeHtml(chronicleBannerTitle(args.style))}</b><span class="char-hub-lead-facts">${escapeHtml(chronicleStatsLabel(chronicleData))}</span><span class="char-hub-lead-more">${leadMoreLabel(args.style)}</span></button>`
    : '';
  const relationBannerHtml = relationGraph.stats.edgeCount > 0
    ? `<button class="char-hub-lead-banner char-hub-relation-graph-banner" data-char-hub-graph="" type="button"><b class="char-hub-lead-name">${escapeHtml(relationGraphTitle(args.style))}</b><span class="char-hub-lead-facts">${relationGraph.stats.nodeCount} 位人物 · ${relationGraph.stats.edgeCount} 段关系</span><span class="char-hub-lead-more">${leadMoreLabel(args.style)}</span></button>`
    : '';
  // 编年史 + 人物关系网两横幅包进折行容器：宽度够并排一行，不够自动折成两行
  const bannerRowHtml = (chronicleBannerHtml || relationBannerHtml)
    ? `<div class="char-hub-banner-row">${chronicleBannerHtml}${relationBannerHtml}</div>`
    : '';
  // 占位卡复用普通人物卡骨架（.char-hub-card），仅以虚线边框+灰化头像作「尚未出场」提示；
  // 不带「查看档案」入口，× 仅移除占位（不删除世界书条目）
  const pendingCard = (name: string): string => `<div class="char-hub-card char-hub-pending-card"><span class="char-hub-portrait"><span class="char-hub-initial">${escapeHtml(getInitials(name))}</span></span><span class="char-hub-card-copy"><b>${escapeHtml(name)}</b><small>待相遇</small><em>人物档案已就绪，等待剧情让 TA 亮相</em></span><button class="char-hub-pending-del" type="button" data-char-hub-pending-del="${escapeHtmlAttr(name)}" aria-label="移除待相遇占位" title="移除占位（不删除世界书条目）">&times;</button></div>`;
  /** 目录页整体重建：初始挂载与「新人物创建写入后/占位移除后」复用，搜索/筛选状态原样恢复。 */
  const renderDirectory = (): void => {
    // 每次重渲染都重读名册：恋爱对象表/重要角色表新增该姓名后，占位卡即让位真实卡片
    records = buildCharacterHubRoster();
    const pendingNames = listPendingEncounters(records.map(item => item.name));
    const pendingSection = pendingNames.length
      ? `<section class="char-hub-pending"><header><span class="char-hub-section-kicker">待相遇</span><small>已预建人物档案 · 等待在故事中与 TA 相遇</small></header><div class="char-hub-pending-wall">${pendingNames.map(pendingCard).join('')}</div></section>`
      : '';
    replaceHtml(directoryRoot, `<form class="char-hub-search" data-char-hub-search-form><span aria-hidden="true">⌕</span><input data-char-hub-search placeholder="搜索人物、身份或简介"><button data-char-hub-search-submit type="submit">搜索</button></form><div class="char-hub-filter-row"><div class="char-hub-filter" role="tablist">${(['all', 'romance', 'important'] as const).map(key => `<button data-char-hub-filter="${key}" class="${key === 'all' ? 'active' : ''}" type="button">${key === 'all' ? '全部' : key === 'romance' ? '恋爱对象' : '重要角色'}</button>`).join('')}</div><button class="char-hub-new-character" data-char-hub-new-character type="button">${ubIcon('plus')} 新人物创建</button></div>${leadBannerHtml}${bannerRowHtml}<div class="char-hub-card-wall">${records.map(directoryCard).join('') || empty('暂无可展示的人物')}</div>${pendingSection}`);
    const searchInput = directoryRoot.querySelector<HTMLInputElement>('[data-char-hub-search]');
    if (searchInput) searchInput.value = searchDraft;
    applyDirectoryFilters();
  };
  const detailRoot = document.createElement('section');
  detailRoot.className = 'char-hub-detail-host';
  detailRoot.hidden = true;
  const leadRoot = document.createElement('section');
  leadRoot.className = 'char-hub-lead-detail-host';
  leadRoot.hidden = true;
  const chronicleRoot = document.createElement('section');
  chronicleRoot.className = 'char-hub-chronicle-host';
  chronicleRoot.hidden = true;
  body.append(directoryRoot, detailRoot, leadRoot, chronicleRoot);

  const applyDirectoryFilters = (): void => {
    const term = appliedSearch.trim().toLocaleLowerCase();
    directoryRoot.querySelectorAll<HTMLElement>('[data-char-hub-open]').forEach(card => {
      const kindMatches = activeFilter === 'all' || card.dataset.charHubKind === activeFilter;
      const textMatches = !term || (card.dataset.charHubSearchable || '').includes(term);
      card.hidden = !kindMatches || !textMatches;
    });
    directoryRoot.querySelectorAll<HTMLElement>('[data-char-hub-filter]').forEach(button => button.classList.toggle('active', button.dataset.charHubFilter === activeFilter));
  };

  renderDirectory();

  const setHubView = (view: 'directory' | 'detail' | 'lead' | 'chronicle'): void => {
    directoryRoot.hidden = view !== 'directory';
    detailRoot.hidden = view !== 'detail';
    leadRoot.hidden = view !== 'lead';
    chronicleRoot.hidden = view !== 'chronicle';
    root.dataset.charHubView = view;
    if (view === 'directory') body.scrollTop = directoryScrollTop;
  };

  const showLead = (p: ProtagonistRecord): void => {
    directoryScrollTop = body.scrollTop;
    const facts = [renderGender(p.gender), p.birthday ? `生日 ${escapeHtml(p.birthday)}` : '', escapeHtml(p.age)].map(v => v ? `<i>${v}</i>` : '').join('');
    const prose = [proseCard('外貌特征', p.appearance, 'is-wide'), proseCard('身份背景', p.identity)].join('');
    replaceHtml(leadRoot, `<div class="char-hub-lead-detail"><div class="char-hub-back-row"><button class="char-hub-back" data-char-hub-back type="button"><span aria-hidden="true">←</span> 返回人物目录</button></div><header class="char-hub-identity char-hub-identity--lead"><div class="char-hub-identity-copy"><small>${escapeHtml(protagonistLabel(args.style))}</small><b>${escapeHtml(p.name)}</b><div class="char-hub-facts">${facts}</div></div></header><section class="char-hub-page char-hub-profile char-hub-lead-profile">${prose || empty('暂无更多人物档案')}</section></div>`);
    setHubView('lead');
    body.scrollTop = 0;
  };

  const showChronicle = (): void => {
    chronicleChar = 'all';
    replaceHtml(chronicleRoot, chroniclePage(buildStoryChronicle(records), args.style));
    setHubView('chronicle');
    body.scrollTop = 0;
  };

  const applyChronicleFilter = (): void => {
    chronicleRoot.querySelectorAll<HTMLElement>('[data-char-hub-cr-char]').forEach(el => {
      el.hidden = chronicleChar !== 'all' && el.dataset.charHubCrChar !== chronicleChar;
    });
    // 该日事件被筛空时整行收起，避免留下孤零零的日期节点
    chronicleRoot.querySelectorAll<HTMLElement>('[data-char-hub-cr-day]').forEach(day => {
      const events = Array.from(day.querySelectorAll<HTMLElement>('[data-char-hub-cr-char]'));
      day.hidden = events.length > 0 && events.every(ev => ev.hidden);
    });
    chronicleRoot.querySelectorAll<HTMLElement>('[data-char-hub-cr-chip]').forEach(chip => {
      chip.classList.toggle('active', (chip.dataset.charHubCrChip || 'all') === chronicleChar);
    });
  };

  const activatePage = (page: HubPage): void => {
    activePage = page;
    detailRoot.querySelectorAll<HTMLElement>('[data-char-hub-page]').forEach(panel => { panel.hidden = panel.dataset.charHubPage !== page; });
    detailRoot.querySelectorAll<HTMLElement>('[data-char-hub-tab]').forEach(tab => {
      const selected = tab.dataset.charHubTab === page;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
    });
  };

  const showDetail = (record: CharacterHubRecord): void => {
    activeRecord = record;
    const tabs: HubPage[] = ['profile', 'relationship', 'personality', 'intimacy', 'milestone'];
    directoryScrollTop = body.scrollTop;
    replaceHtml(detailRoot, `<div class="char-hub-detail"><div class="char-hub-back-row"><button class="char-hub-back" data-char-hub-back type="button"><span aria-hidden="true">←</span> 返回人物目录</button></div><header class="char-hub-identity"><button class="char-hub-portrait char-hub-gallery" data-char-hub-gallery="${escapeHtmlAttr(record.name)}" type="button" aria-label="查看 ${escapeHtmlAttr(record.name)} 的立绘">${portrait(record)}</button><div class="char-hub-identity-copy"><small>${record.kind === 'romance' ? 'ROMANCE ARCHIVE' : 'IMPORTANT PERSON'}</small><b>${escapeHtml(record.name)}</b><span>${escapeHtml(record.briefIntro || record.identity || '暂无人物摘要')}</span><div class="char-hub-facts">${record.gender ? `<i>${renderGender(record.gender)}</i>` : ''}${record.age ? `<i>${escapeHtml(record.age)}</i>` : ''}${record.birthday ? `<i>${escapeHtml(record.birthday)}</i>` : ''}${record.identity ? `<i>${escapeHtml(record.identity)}</i>` : ''}</div>${addressChip(record.nsfw)}</div><div class="char-hub-actions"><button class="char-hub-action char-hub-action--investigate ub-lp-hint" data-char-hub-investigate="${escapeHtmlAttr(record.name)}" type="button"${args.investigationEnabled ? '' : ' hidden'}>${ubIcon('search')} 大调查</button><button class="char-hub-action char-hub-action--interview" data-char-hub-interview="${escapeHtmlAttr(record.name)}" type="button"${args.interviewEnabled ? '' : ' hidden'}>${ubIcon('mic')} 大采访</button></div></header><nav class="char-hub-tabs" role="tablist">${tabs.map((tab, index) => `<button data-char-hub-tab="${tab}" class="${index === 0 ? 'active' : ''}" type="button" role="tab" aria-selected="${index === 0}">${tab === 'profile' ? '人物档案' : tab === 'relationship' ? '关系与经历' : tab === 'personality' ? '性格变化' : tab === 'milestone' ? '人生里程碑' : '亲密档案'}</button>`).join('')}</nav><div class="char-hub-page-stack">${tabs.map(tab => detailPage(record, tab, args.style, records, relationRows, rosterOrder, !relationSheet)).join('')}</div></div>`);
    activePage = 'profile';
    activatePage(activePage);
    setHubView('detail');
    body.scrollTop = 0;
    const host = detailRoot.querySelector<HTMLElement>('[data-char-hub-worldbook]');
    const scanToken = ++worldbookScanToken;
    if (host) void (async () => {
      try {
        const status = await createDefaultCharacterWorldbookService().scanCharacterWorldbook(record.name);
        if (scanToken !== worldbookScanToken || host.dataset.charHubWorldbook !== record.name) return;
        const hits = status.hits.length
          ? `<div class="char-hub-worldbook-hits">${status.hits.map(hit => `<span>${escapeHtml(hit.name || String(hit.uid))}</span>`).join('')}</div>`
          : '<p>主世界书中未找到名称或关键词关联该角色的条目。</p>';
        host.innerHTML = `<header><span class="char-hub-section-kicker">角色世界书</span><small>${escapeHtml(status.primaryName)}</small></header><div class="char-hub-worldbook-status ${status.hits.length ? 'is-green' : 'is-red'}"><i></i><b>${status.hits.length ? '已关联' : '未关联'}</b></div>${hits}<div class="char-hub-worldbook-actions"><button type="button" data-char-hub-worldbook-create="${escapeHtmlAttr(record.name)}">创建人物档案</button><button type="button" data-char-hub-worldbook-update="${escapeHtmlAttr(record.name)}"${status.hits.length ? '' : ' disabled'}>更新已有条目</button></div>`;
      } catch (error) {
        if (scanToken !== worldbookScanToken) return;
        host.innerHTML = `<p class="char-hub-worldbook-error">${escapeHtml(error instanceof Error ? error.message : String(error))}</p><div class="char-hub-worldbook-actions"><button type="button" disabled>创建人物档案</button><button type="button" disabled>更新已有条目</button></div>`;
      }
    })();
  };

  const deleteMilestoneEntry = async (name: string, index: number, shown: MilestoneEntry): Promise<void> => {
    const toastr = getToastr();
    const sheet = getSheetByName('角色里程碑表');
    if (!sheet?.content?.length) { toastr?.error('找不到角色里程碑表', '人生里程碑'); return; }
    const headers = sheet.content[0] || [];
    const nameCol = headers.indexOf('姓名');
    const col = headers.indexOf('里程碑事件');
    if (nameCol === -1 || col === -1) { toastr?.error('角色里程碑表缺少所需列', '人生里程碑'); return; }
    let rowIndex = -1;
    for (let i = 1; i < sheet.content.length; i++) {
      if (String(sheet.content[i][nameCol] || '').trim() === name) { rowIndex = i; break; }
    }
    if (rowIndex === -1) { toastr?.error('未找到该角色的里程碑记录', '人生里程碑'); return; }
    const raw = String(sheet.content[rowIndex][col] || '');
    // 防展示与库不一致时误删：重新解析当前单元格，目标位条目必须与所删一致
    const target = parseMilestoneEvents(raw)[index];
    if (!target || target.dateKey !== shown.dateKey || target.description !== shown.description
      || (target.raw || '') !== (shown.raw || '') || (target.category || '') !== (shown.category || '')) {
      toastr?.warning('里程碑数据已变化，请关闭后重新打开再试', '人生里程碑');
      return;
    }
    const next = removeMilestoneEvent(raw, index);
    if (next === raw) { toastr?.error('删除失败：未找到该条目', '人生里程碑'); return; }
    if (!(await updateCell('角色里程碑表', rowIndex, '里程碑事件', next))) {
      toastr?.error('删除失败（存储未就绪）', '人生里程碑');
      return;
    }
    toastr?.success('里程碑事件已删除', '人生里程碑');
    const updated = buildCharacterHubRoster().find(item => item.name === name);
    if (!updated) return;
    const slot = records.findIndex(item => item.name === name);
    if (slot >= 0) records[slot] = updated;
    activeRecord = updated;
    const pageStack = detailRoot.querySelector<HTMLElement>('.char-hub-page-stack');
    const msSection = pageStack?.querySelector<HTMLElement>('[data-char-hub-page="milestone"]');
    if (msSection) msSection.outerHTML = milestonePage(updated, args.style);
  };

  overlay.replaceChildren(root);
  markPopupShown();
  overlay.classList.add('show');
  overlay.onclick = null;
  overlay.oninput = null;
  overlay.onsubmit = null;
  const closeHub = (): void => {
    overlay.removeEventListener('click', onOverlayClick);
    closePanelOverlayOrReturn(overlay);
  };
  const onOverlayClick = (event: MouseEvent): void => {
    if (event.target === overlay && !guardGhostClick()) closeHub();
  };
  const restoreHub = (): void => {
    overlay.onclick = null;
    overlay.replaceChildren(root);
    markPopupShown();
    overlay.classList.add('show');
    activatePage(activePage);
    requestAnimationFrame(() => { body.scrollTop = detailScrollTop; });
  };
  // 子弹窗（回顾/关系网/图库/世界书/调查/采访/过往经历）接管同一 overlay 期间必须摘除
  // 本弹窗的遮罩点击监听，否则一次背景点击会同时走两条弹窗链路（历史坑：图库/世界书
  // 路径漏摘 → 遮罩误触把多步表单和整个中枢静默关闭）。所有子窗出口统一走 childRestore。
  const detachOverlayClick = (): void => overlay.removeEventListener('click', onOverlayClick);
  const childRestore = (): void => { restoreHub(); overlay.addEventListener('click', onOverlayClick); installHubTakeoverGuard(); };
  // F2（弹窗接管泄漏）：除子弹窗（有 detach/restore 原机制）外，任意弹窗直接重写 overlay
  // 内容时这枚 addEventListener 没有摘除时机——残留处理器会在后续弹窗的背景点击里执行
  // closePanelOverlayOrReturn，误消费新弹窗的返回链（把多步表单静默关掉）。childList 兜底：
  // root 被移出 overlay 即摘监听。子弹窗往返会重建守卫（restore 时 root 已回到 overlay）。
  let hubTakeover: MutationObserver | null = null;
  const installHubTakeoverGuard = (): void => {
    hubTakeover?.disconnect();
    hubTakeover = new MutationObserver(() => {
      if (overlay.contains(root)) return;
      hubTakeover?.disconnect();
      hubTakeover = null;
      overlay.removeEventListener('click', onOverlayClick);
    });
    hubTakeover.observe(overlay, { childList: true });
  };
  overlay.addEventListener('click', onOverlayClick);
  installHubTakeoverGuard();
  // 大调查按钮长按（U10：统一走 long-press 模块）：短按开调查，长按弹额外要求框。
  bindLongPressDelegated<HTMLButtonElement>(root, '[data-char-hub-investigate]', {
    canStart: (btn) => { const name = btn.dataset.charHubInvestigate || ''; return !!name && !isInvestigating(name); },
    onShort: (btn) => {
      const name = btn.dataset.charHubInvestigate || '';
      if (!name || isInvestigating(name)) return;
      detailScrollTop = body.scrollTop;
      detachOverlayClick();
      args.openInvestigation(name, btn, childRestore);
    },
    onLong: (btn) => {
      const name = btn.dataset.charHubInvestigate || '';
      if (!name) return;
      detailScrollTop = body.scrollTop;
      detachOverlayClick();
      args.openInvestigationExtraPrompt(name, btn, childRestore);
    },
  });
  root.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    if (target.closest('#panelClose')) { if (!guardGhostClick()) closeHub(); return; }
    const leadBtn = target.closest<HTMLElement>('[data-char-hub-lead]');
    if (leadBtn) { const p = buildProtagonistRecord(); if (p) showLead(p); return; }
    if (target.closest<HTMLElement>('[data-char-hub-chronicle]')) { directoryScrollTop = body.scrollTop; showChronicle(); return; }
    const crChip = target.closest<HTMLElement>('[data-char-hub-cr-chip]');
    if (crChip) { chronicleChar = crChip.dataset.charHubCrChip || 'all'; applyChronicleFilter(); return; }
    const crJump = target.closest<HTMLElement>('[data-char-hub-cr-jump]');
    if (crJump) {
      const dateKey = crJump.dataset.charHubCrJump || '';
      if (!dateKey) return;
      detailScrollTop = body.scrollTop;
      detachOverlayClick();
      void showChronicleReaderPopup(args.style, { dateKey, onClosed: childRestore });
      return;
    }
    // 大调查按钮的短按/长按已由 bindLongPressDelegated 处理（含长按后合成 click 的吞噬），此处只放行
    if (target.closest<HTMLElement>('[data-char-hub-investigate]')) return;
    const interview = target.closest<HTMLButtonElement>('[data-char-hub-interview]');
    if (interview) {
      const name = interview.dataset.charHubInterview || '';
      if (name && !isInterviewing(name)) { detailScrollTop = body.scrollTop; detachOverlayClick(); args.openInterview(name, interview, childRestore); }
      return;
    }
    const open = target.closest<HTMLElement>('[data-char-hub-open]');
    if (open) { const record = records.find(row => row.name === open.dataset.charHubOpen); if (record) showDetail(record); return; }
    if (target.closest('[data-char-hub-back]')) { setHubView('directory'); return; }
    const filterButton = target.closest<HTMLElement>('[data-char-hub-filter]');
    if (filterButton) { activeFilter = filterButton.dataset.charHubFilter as DirectoryFilter; applyDirectoryFilters(); return; }
    if (target.closest('[data-char-hub-new-character]')) {
      directoryScrollTop = body.scrollTop;
      detachOverlayClick();
      showCharacterWorldbookDialog({ mode: 'create', fresh: true, style: args.style, characterName: '', restoreHub: childRestore, onCommitted: () => { renderDirectory(); setHubView('directory'); } });
      return;
    }
    const pendingDel = target.closest<HTMLElement>('[data-char-hub-pending-del]');
    if (pendingDel) {
      const name = pendingDel.dataset.charHubPendingDel || '';
      if (!name) return;
      void showConfirmDialog({
        title: '移除待相遇占位',
        message: `确定移除「${name}」的待相遇占位吗？这不会删除已写入世界书的人物档案条目。`,
        okText: '移除',
        cancelText: '取消',
        danger: true,
      }).then(confirmed => {
        if (!confirmed) return;
        dropPendingEncounter(name);
        renderDirectory();
      });
      return;
    }
    const tab = target.closest<HTMLElement>('[data-char-hub-tab]');
    if (tab) { activatePage(tab.dataset.charHubTab as HubPage); return; }
    const related = target.closest<HTMLElement>('[data-char-hub-related]');
    if (related) {
      const name = related.dataset.charHubRelated || '';
      if (protagonist?.name && name === protagonist.name) { showLead(buildProtagonistRecord() || protagonist); return; }
      const record = records.find(row => row.name === name);
      if (record) showDetail(record);
      return;
    }
    const graphBtn = target.closest<HTMLElement>('[data-char-hub-graph]');
    if (graphBtn) {
      detailScrollTop = body.scrollTop;
      detachOverlayClick();
      showCharacterRelationGraphPopup({ style: args.style, initialFocus: graphBtn.dataset.charHubGraph || undefined, onClosed: childRestore });
      return;
    }
    const gallery = target.closest<HTMLElement>('[data-char-hub-gallery]');
    if (gallery) { detachOverlayClick(); showPortraitGalleryPopup(gallery.dataset.charHubGallery || '', args.style, 'browse', undefined, childRestore); return; }
    const createWorldbook = target.closest<HTMLElement>('[data-char-hub-worldbook-create]');
    if (createWorldbook) {
      detailScrollTop = body.scrollTop;
      detachOverlayClick();
      showCharacterWorldbookDialog({ mode: 'create', style: args.style, characterName: createWorldbook.dataset.charHubWorldbookCreate || '', restoreHub: childRestore, onCommitted: () => { const record = records.find(item => item.name === createWorldbook.dataset.charHubWorldbookCreate); if (record) showDetail(record); } });
      return;
    }
    const updateWorldbook = target.closest<HTMLElement>('[data-char-hub-worldbook-update]');
    if (updateWorldbook) {
      detailScrollTop = body.scrollTop;
      detachOverlayClick();
      showCharacterWorldbookDialog({ mode: 'update', style: args.style, characterName: updateWorldbook.dataset.charHubWorldbookUpdate || '', restoreHub: childRestore, onCommitted: () => { const record = records.find(item => item.name === updateWorldbook.dataset.charHubWorldbookUpdate); if (record) showDetail(record); } });
      return;
    }
    const msDel = target.closest<HTMLElement>('[data-char-hub-ms-del]');
    if (msDel) {
      const index = Number(msDel.dataset.charHubMsDel);
      if (!Number.isInteger(index) || !activeRecord) return;
      const entry = activeRecord.milestones[index];
      if (!entry) return;
      const stamp = entry.dateParts ? formatMilestoneDate(entry, args.style) : entry.dateKey;
      const preview = stamp ? `${stamp} · ${entry.description}` : entry.description;
      const name = activeRecord.name;
      void showConfirmDialog({
        title: '删除里程碑',
        message: `确定删除「${preview}」吗？删除后不可恢复。`,
        okText: '删除',
        cancelText: '取消',
        danger: true,
      }).then(confirmed => {
        if (!confirmed) return;
        void deleteMilestoneEntry(name, index, entry);
      });
      return;
    }
    const msJump = target.closest<HTMLElement>('[data-char-hub-milestone]');
    if (msJump) {
      const dateKey = msJump.dataset.charHubMilestone || '';
      if (!dateKey) return;
      detailScrollTop = body.scrollTop;
      detachOverlayClick();
      void showChronicleReaderPopup(args.style, { dateKey, onClosed: childRestore });
      return;
    }
    const past = target.closest<HTMLElement>('[data-char-hub-past]');
    if (past) { detailScrollTop = body.scrollTop; detachOverlayClick(); args.openPastExperience(past.dataset.charHubPast || '', childRestore); }
  });
  root.addEventListener('input', event => {
    const target = event.target as HTMLInputElement;
    if (target.matches('[data-char-hub-search]')) searchDraft = target.value;
  });
  root.addEventListener('submit', event => {
    const form = event.target as HTMLFormElement;
    if (!form.matches('[data-char-hub-search-form]')) return;
    event.preventDefault();
    appliedSearch = searchDraft;
    applyDirectoryFilters();
  });
  const initial = records.find(row => row.name === args.initialCharacter);
  if (initial) showDetail(initial);
  else if (protagonist && args.initialCharacter === protagonist.name) showLead(protagonist);
  else setHubView('directory');
}
