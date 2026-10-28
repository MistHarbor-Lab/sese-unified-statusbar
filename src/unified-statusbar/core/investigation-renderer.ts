// ===== 大调查档案美化渲染器 v5 =====
// 机密档案风格 — 亮/暗双模、朱红强调、烫金点缀
// 零模板字面量，纯字符串拼接

import type { InvestigationData, ScoreValue } from './investigation-parser';
import { renderDonutChart, extractLeadingNumber, objectCountNumber, objectGenderSubLine } from './investigation-parser';
import { escapeHtml as esc } from './html-escape';

// ===================================================================
// 亮 / 暗 两套色板
// ===================================================================
var LIGHT = {
  bg: '#f8f4ec', card: '#fefcf7', cardAlt: '#f0ebe0',
  text: '#2c2416', textSub: '#6b5e4a', textMuted: '#988870',
  red: '#b5362e', redDark: '#8b1a12', redGlow: 'rgba(181,54,46,0.08)',
  gold: '#8b6d30', goldPale: 'rgba(139,109,48,0.08)',
  border: '#d8cfb8', divider: '#e8e0cc',
  barBg: '#e8dcc8', barFill: '#b5362e',
  tagBg: 'rgba(181,54,46,0.06)', tagBorder: 'rgba(181,54,46,0.16)', tagText: '#8b1a12',
  charmBg: 'rgba(139,109,48,0.08)', charmBorder: 'rgba(139,109,48,0.20)', charmText: '#7a5a20',
  lostBg: 'rgba(181,54,46,0.08)', lostBorder: 'rgba(181,54,46,0.25)', lostText: '#b5362e',
  pureBg: 'rgba(90,130,90,0.08)', pureBorder: 'rgba(90,130,90,0.20)', pureText: '#5a825a',
  tableStripe: 'rgba(0,0,0,0.02)',
  ageYoung: '#5a905a', agePrime: '#8b6d30', ageMature: '#c07830', ageSenior: '#b5362e',
  heroBgFrom: '#f0ebe0', heroBgTo: '#f8f4ec',
  font: "'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun','LXGW WenKai','Kaiti SC','STKaiti','KaiTi','楷体','Noto Serif CJK SC','Songti SC',serif",
  fontMono: "'SF Mono','Cascadia Code','Consolas',monospace",
  popupShadow: '0 4px 32px rgba(0,0,0,0.12)',
};
var DARK = {
  bg: '#1b1b1d', card: '#222225', cardAlt: '#27272a',
  text: '#e0dcd0', textSub: '#a09888', textMuted: '#9a8a78',
  red: '#c41e3a', redDark: '#9a1628', redGlow: 'rgba(196,30,58,0.10)',
  gold: '#c9a050', goldPale: 'rgba(201,160,80,0.10)',
  border: '#333235', divider: '#2a2a2d',
  barBg: '#2a2a2e', barFill: '#c41e3a',
  tagBg: 'rgba(196,30,58,0.06)', tagBorder: 'rgba(196,30,58,0.16)', tagText: '#d47078',
  charmBg: 'rgba(201,160,80,0.08)', charmBorder: 'rgba(201,160,80,0.20)', charmText: '#d4b868',
  lostBg: 'rgba(196,30,58,0.10)', lostBorder: 'rgba(196,30,58,0.30)', lostText: '#e04858',
  pureBg: 'rgba(90,130,90,0.08)', pureBorder: 'rgba(90,130,90,0.20)', pureText: '#7aaa7a',
  tableStripe: 'rgba(255,255,255,0.015)',
  ageYoung: '#7aaa7a', agePrime: '#c9a050', ageMature: '#d4783a', ageSenior: '#c41e3a',
  heroBgFrom: '#1e1e21', heroBgTo: '#1b1b1d',
  font: "'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun','LXGW WenKai','Kaiti SC','STKaiti','KaiTi','楷体','Noto Serif CJK SC','Songti SC',serif",
  fontMono: "'SF Mono','Cascadia Code','Consolas',monospace",
  popupShadow: '0 8px 48px rgba(0,0,0,0.5)',
};

// ===================================================================
// 工具
// ===================================================================

/** 提取年龄并返回色值（使用解析后的年龄数字） */
function ageColor(ageStr: string): string {
  var a = parseInt(ageStr, 10);
  if (isNaN(a)) return '';
  if (a <= 18) return 'var(--iv-age-young)';
  if (a <= 25) return 'var(--iv-age-prime)';
  if (a <= 30) return 'var(--iv-age-mature)';
  return 'var(--iv-age-senior)';
}

/** 纯洁值 → 环颜色CSS变量 */
function purityRingColor(val: number): string {
  if (val <= 25) return 'var(--iv-ring-low)';
  if (val <= 50) return 'var(--iv-ring-mid)';
  if (val <= 75) return 'var(--iv-ring-high)';
  return 'var(--iv-ring-top)';
}

/** 身体/开发数据中所有数字加粗 */
function boldNumbers(text: string): string {
  return text.replace(/(\d+(?:\.\d+)?)/g, '<b>$1</b>');
}
/** 计数字段是否为正数(>0);"0次"/"无"/空 视为 0 → false;含正数 → true。生育块按次数显隐 */
function hasPositiveCount(s: string): boolean {
  if (!s) return false;
  var m = String(s).match(/\d+(?:\.\d+)?/);
  return !!(m && parseFloat(m[0]) > 0);
}

/** CSS变量定义块 */
function cssVars(p: typeof LIGHT): string {
  var s = '';
  s += '--iv-bg:' + p.bg + ';';
  s += '--iv-card:' + p.card + ';';
  s += '--iv-card-alt:' + p.cardAlt + ';';
  s += '--iv-text:' + p.text + ';';
  s += '--iv-text-sub:' + p.textSub + ';';
  s += '--iv-text-muted:' + p.textMuted + ';';
  s += '--iv-red:' + p.red + ';';
  s += '--iv-red-dark:' + p.redDark + ';';
  s += '--iv-red-glow:' + p.redGlow + ';';
  s += '--iv-gold:' + p.gold + ';';
  s += '--iv-gold-pale:' + p.goldPale + ';';
  s += '--iv-border:' + p.border + ';';
  s += '--iv-divider:' + p.divider + ';';
  s += '--iv-bar-bg:' + p.barBg + ';';
  s += '--iv-bar-fill:' + p.barFill + ';';
  s += '--iv-tag-bg:' + p.tagBg + ';';
  s += '--iv-tag-border:' + p.tagBorder + ';';
  s += '--iv-tag-text:' + p.tagText + ';';
  s += '--iv-charm-bg:' + p.charmBg + ';';
  s += '--iv-charm-border:' + p.charmBorder + ';';
  s += '--iv-charm-text:' + p.charmText + ';';
  s += '--iv-lost-bg:' + p.lostBg + ';';
  s += '--iv-lost-border:' + p.lostBorder + ';';
  s += '--iv-lost-text:' + p.lostText + ';';
  s += '--iv-pure-bg:' + p.pureBg + ';';
  s += '--iv-pure-border:' + p.pureBorder + ';';
  s += '--iv-pure-text:' + p.pureText + ';';
  s += '--iv-table-stripe:' + p.tableStripe + ';';
  s += '--iv-age-young:' + p.ageYoung + ';';
  s += '--iv-age-prime:' + p.agePrime + ';';
  s += '--iv-age-mature:' + p.ageMature + ';';
  s += '--iv-age-senior:' + p.ageSenior + ';';
  s += '--iv-hero-from:' + p.heroBgFrom + ';';
  s += '--iv-hero-to:' + p.heroBgTo + ';';
  s += '--iv-font:' + p.font + ';';
  s += '--iv-font-mono:' + p.fontMono + ';';
  s += '--iv-popup-shadow:' + p.popupShadow + ';';
  // 纯洁环颜色（不随主题变，本身就是数据驱动的）
  s += '--iv-ring-low:#c41e3a;';
  s += '--iv-ring-mid:#d4783a;';
  s += '--iv-ring-high:#c9a050;';
  s += '--iv-ring-top:#7aaa7a;';
  return s;
}

// ===================================================================
// CSS — 全部使用CSS自定义属性，一套规则适配亮暗
// ===================================================================
function buildCSS(): string {
  var css = '';

  // 亮色变量 / 暗色覆盖
  css += '.iv-wrap{' + cssVars(LIGHT) + '}';
  css += '.dark .iv-wrap{' + cssVars(DARK) + '}';

  // ——— 弹出框 ———
  css += '.iv-popup{display:flex;flex-direction:column;max-width:860px;width:100%;max-height:88vh;background:var(--iv-bg);border:1px solid var(--iv-border);box-shadow:var(--iv-popup-shadow);overflow:hidden;box-sizing:border-box;}';
  css += '.iv-popup-body{flex:1;overflow-y:auto;overflow-x:hidden;}';
  css += '.iv-popup-body::-webkit-scrollbar{width:4px;}';
  css += '.iv-popup-body::-webkit-scrollbar-track{background:transparent;}';
  css += '.iv-popup-body::-webkit-scrollbar-thumb{background:var(--iv-divider);}';
  css += '.iv-popup-body::-webkit-scrollbar-thumb:hover{background:var(--iv-border);}';
  // — 顶部操作栏（档案首行） —
  css += '.iv-top-bar{display:flex;align-items:center;justify-content:space-between;padding:14px 22px;border-bottom:2px solid var(--iv-border);background:var(--iv-card-alt);flex-shrink:0;position:sticky;top:0;z-index:5;}';
  css += '.iv-top-bar .iv-name{font-family:var(--iv-font);font-size:15px;font-weight:700;color:var(--iv-text);letter-spacing:3px;}';
  css += '.iv-top-bar .iv-btns{display:flex;gap:8px;align-items:center;}';
  css += '.iv-top-btn{font-family:var(--iv-font);font-size:10.5px;letter-spacing:2px;padding:5px 14px;cursor:pointer;transition:all 0.2s;background:transparent;border:1px solid var(--iv-border);color:var(--iv-text-sub);white-space:nowrap;}';
  css += '.iv-top-btn:hover{border-color:var(--iv-red);color:var(--iv-red);background:var(--iv-red-glow);}';
  css += '.iv-top-close{width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:transparent;border:1px solid var(--iv-border);color:var(--iv-text-muted);font-size:14px;cursor:pointer;transition:all 0.2s;flex-shrink:0;line-height:1;padding:0;}';
  css += '.iv-top-close:hover{border-color:var(--iv-red);color:var(--iv-red);background:var(--iv-red-glow);}';

  // ——— 内容区 ———
  css += '.iv-wrap{font-family:var(--iv-font);background:var(--iv-bg);color:var(--iv-text);line-height:1.7;font-size:13px;}';
  css += '.iv-wrap *{margin:0;padding:0;box-sizing:border-box;}';
  css += '.iv-wrap b{color:var(--iv-red);font-weight:700;}';

  // Hero
  css += '.iv-hero{position:relative;text-align:center;padding:32px 24px 20px;background:linear-gradient(180deg,var(--iv-hero-from) 0%,var(--iv-hero-to) 100%);border-bottom:1px solid var(--iv-border);}';
  css += '.iv-hero::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--iv-red),transparent);}';
  css += '.iv-hero::after{content:"";position:absolute;top:8px;left:16px;width:12px;height:12px;border-left:1px solid var(--iv-border);border-top:1px solid var(--iv-border);}';
  css += '.iv-hero-corner{position:absolute;top:8px;right:16px;width:12px;height:12px;border-right:1px solid var(--iv-border);border-top:1px solid var(--iv-border);}';
  css += '.iv-hero-top{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;margin-bottom:6px;}';
  css += '.iv-hero-name{font-size:26px;font-weight:700;letter-spacing:6px;color:var(--iv-text);}';
  css += '.iv-hero-grade{display:inline-flex;align-items:center;justify-content:center;min-width:58px;height:32px;padding:0 14px;font-size:16px;font-weight:800;letter-spacing:6px;color:#fff;background:var(--iv-red);transform:rotate(-1.5deg);box-shadow:2px 2px 0 var(--iv-red-dark);}';
  css += '.iv-hero-rank{font-size:11px;color:var(--iv-text-muted);letter-spacing:3px;margin-top:2px;}';
  css += '.iv-hero-desc{font-size:12.5px;color:var(--iv-text-sub);line-height:1.85;max-width:680px;margin:12px auto 0;text-align:left;font-style:italic;padding:12px 16px;border-left:3px solid var(--iv-red);background:var(--iv-card);}';

  // Section
  css += '.iv-sec-title{font-size:10px;font-weight:600;letter-spacing:4px;color:var(--iv-red);text-transform:uppercase;padding:22px 22px 8px;margin-bottom:6px;border-bottom:1px solid var(--iv-divider);display:flex;align-items:center;gap:10px;}';
  css += '.iv-sec-title em{font-style:normal;color:var(--iv-text-muted);font-weight:400;font-size:9px;letter-spacing:2px;margin-left:auto;}';
  css += '.iv-sec{margin:0 20px 12px;padding:18px 20px;background:var(--iv-card);border:1px solid var(--iv-border);}';

  // Basic
  css += '.iv-basic-row{display:flex;gap:20px;align-items:baseline;flex-wrap:wrap;margin-bottom:8px;}';
  css += '.iv-basic-row .lbl{color:var(--iv-text-muted);font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;margin-right:6px;}';
  css += '.iv-basic-body{font-size:12.5px;color:var(--iv-text-sub);line-height:1.75;}';

  // Style 3-col
  css += '.iv-style-row{display:flex;gap:14px;}';
  css += '.iv-style-col{flex:1;min-width:0;}';
  css += '.iv-style-col h4{font-size:9.5px;text-transform:uppercase;letter-spacing:2.5px;color:var(--iv-red);margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--iv-divider);}';
  css += '.iv-style-col p{font-size:12px;color:var(--iv-text-sub);line-height:1.75;}';

  // Score bar
  css += '.iv-score{margin-bottom:9px;}';
  css += '.iv-score-row{display:flex;align-items:center;gap:10px;}';
  css += '.iv-score-lbl{font-size:11px;color:var(--iv-text-muted);min-width:72px;text-align:right;letter-spacing:1px;}';
  css += '.iv-score-bar{flex:1;height:6px;background:var(--iv-bar-bg);overflow:hidden;}';
  css += '.iv-score-fill{height:100%;background:var(--iv-bar-fill);transition:width 0.6s ease;}';
  css += '.iv-score-num{font-size:13px;font-weight:800;color:var(--iv-red);min-width:46px;font-family:var(--iv-font-mono);}';
  css += '.iv-score-desc{font-size:10.5px;color:var(--iv-text-muted);margin-left:82px;margin-top:2px;line-height:1.5;}';

  // Tags (dual: red + gold)
  css += '.iv-tags{display:flex;flex-wrap:wrap;gap:5px;}';
  css += '.iv-tag{display:inline-block;padding:3px 10px;font-size:10.5px;letter-spacing:1px;background:var(--iv-tag-bg);border:1px solid var(--iv-tag-border);color:var(--iv-tag-text);}';
  css += '.iv-tag.charm{background:var(--iv-charm-bg);border:1px solid var(--iv-charm-border);color:var(--iv-charm-text);}';

  // Purity ring
  css += '.iv-pure-ring-wrap{text-align:center;}';
  css += '.iv-pure-ring{display:inline-flex;align-items:center;justify-content:center;width:90px;height:90px;border-radius:50%;font-size:24px;font-weight:800;font-family:var(--iv-font-mono);position:relative;border-width:3px;border-style:solid;}';
  css += '.iv-pure-lbl{font-size:9px;color:var(--iv-text-muted);margin-top:6px;letter-spacing:3px;text-transform:uppercase;}';
  css += '.iv-pure-info{display:flex;flex-direction:column;gap:10px;}';
  css += '.iv-pure-info-row{font-size:12.5px;}';
  css += '.iv-pure-info-row .lbl{color:var(--iv-text-muted);letter-spacing:1.5px;font-size:10.5px;text-transform:uppercase;margin-right:8px;}';
  css += '.iv-pure-info-row .val{color:var(--iv-text);font-weight:500;}';

  // Purity detail — horizontal rows, not table
  css += '.iv-pd-list{display:flex;flex-direction:column;gap:1px;margin-top:4px;}';
  css += '.iv-pd-row{display:flex;align-items:center;gap:10px;padding:6px 10px;font-size:12px;}';
  css += '.iv-pd-row:nth-child(even){background:var(--iv-table-stripe);}';
  css += '.iv-pd-name{color:var(--iv-text);font-weight:500;min-width:80px;}';
  css += '.iv-pd-data{color:var(--iv-text-sub);font-size:11px;flex:1;}';
  css += '.iv-badge{display:inline-block;padding:2px 10px;font-size:9.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;}';
  css += '.iv-badge.lost{background:var(--iv-lost-bg);color:var(--iv-lost-text);border:1px solid var(--iv-lost-border);}';
  css += '.iv-badge.pure{background:var(--iv-pure-bg);color:var(--iv-pure-text);border:1px solid var(--iv-pure-border);}';

  // Stat cards
  css += '.iv-stat-cards{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;}';
  css += '.iv-stat-card{flex:1;min-width:110px;text-align:center;padding:18px 10px 14px;background:var(--iv-card-alt);border:1px solid var(--iv-border);}';
  css += '.iv-stat-num{font-size:30px;font-weight:800;color:var(--iv-red);line-height:1;font-family:var(--iv-font-mono);}';
  css += '.iv-stat-lbl{font-size:9px;color:var(--iv-text-muted);letter-spacing:3px;text-transform:uppercase;margin-top:6px;}';

  // Table
  css += '.iv-tbl{width:100%;border-collapse:collapse;font-size:11.5px;}';
  css += '.iv-tbl th{text-align:left;font-weight:500;color:var(--iv-text-muted);font-size:9.5px;text-transform:uppercase;letter-spacing:2px;padding:6px 10px;border-bottom:2px solid var(--iv-divider);}';
  css += '.iv-tbl td{padding:5px 10px;border-bottom:1px solid var(--iv-divider);color:var(--iv-text-sub);}';
  css += '.iv-tbl tr:nth-child(even) td{background:var(--iv-table-stripe);}';

  // Dev rows
  css += '.iv-dev-row{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--iv-divider);align-items:flex-start;}';
  css += '.iv-dev-row:last-child{border-bottom:none;}';
  css += '.iv-dev-label{font-size:10.5px;font-weight:600;letter-spacing:2px;color:var(--iv-red);text-transform:uppercase;min-width:80px;flex-shrink:0;padding-top:2px;}';
  css += '.iv-dev-body{font-size:12px;color:var(--iv-text-sub);line-height:1.75;flex:1;}';

  // Exp timeline
  css += '.iv-exp-wrap{border-left:2px solid var(--iv-border);margin-left:10px;padding-left:18px;}';
  css += '.iv-exp-item{margin-bottom:16px;position:relative;}';
  css += '.iv-exp-item:last-child{margin-bottom:0;}';
  css += '.iv-exp-item h4{font-size:10.5px;letter-spacing:2.5px;color:var(--iv-red);text-transform:uppercase;margin-bottom:4px;}';
  css += '.iv-exp-item p{font-size:12px;color:var(--iv-text-sub);line-height:1.75;}';
  css += '.iv-exp-item::before{content:"";position:absolute;left:-24px;top:6px;width:8px;height:8px;background:var(--iv-red);border-radius:50%;}';

  // Reviews
  css += '.iv-rev-list{display:flex;flex-direction:column;gap:4px;margin-top:6px;}';
  css += '.iv-rev{font-size:12px;color:var(--iv-text-sub);line-height:1.65;padding:8px 12px;border-left:2px solid var(--iv-divider);background:var(--iv-card-alt);}';
  css += '.iv-rev strong{color:var(--iv-text);}';
  css += '.iv-rev .qt{color:var(--iv-gold);}';

  // Rank
  css += '.iv-rank-pro{color:var(--iv-pure-text);font-weight:600;}';
  css += '.iv-rank-con{color:var(--iv-lost-text);font-weight:600;}';

  // Responsive
  css += '@media(max-width:600px){.iv-style-row{flex-direction:column;}.iv-stat-cards{flex-direction:column;}.iv-dev-label{min-width:60px;}}';

  return css;
}

// ===================================================================
// HTML 构建器
// ===================================================================

function buildHero(d: InvestigationData): string {
  var h = '<div class="iv-hero">';
  h += '<div class="iv-hero-corner"></div>';
  h += '<div class="iv-hero-top">';
  h += '<span class="iv-hero-name">' + esc(d.name || '—') + '</span>';
  if (d.grade) h += '<span class="iv-hero-grade">' + esc(d.grade) + '</span>';
  h += '</div>';
  if (d.globalRank) h += '<div class="iv-hero-rank">' + esc(d.globalRank) + '</div>';
  if (d.description) h += '<div class="iv-hero-desc">' + esc(d.description) + '</div>';
  h += '</div>';
  return h;
}

function buildBasic(d: InvestigationData): string {
  var h = '<div class="iv-sec-title">基本档案<em>BASIC PROFILE</em></div>';
  h += '<div class="iv-sec">';
  if (d.sex || d.age) {
    var ageNum = parseInt(d.age, 10);
    var ageDisplay = isNaN(ageNum) ? d.age : String(ageNum);
    var ac = ageColor(d.age);
    h += '<div class="iv-basic-row">';
    if (d.sex) h += '<span><span class="lbl">性别</span><span style="color:var(--iv-text);font-weight:500;">' + esc(d.sex) + '</span></span>';
    if (d.age) h += '<span><span class="lbl">年龄</span><span style="color:' + ac + ';font-weight:700;font-family:var(--iv-font-mono);">' + esc(ageDisplay) + '</span></span>';
    h += '</div>';
  }
  if (d.body) {
    h += '<div class="iv-basic-body">' + boldNumbers(esc(d.body)) + '</div>';
  }
  h += '</div>';
  return h;
}

function buildStyle(d: InvestigationData): string {
  if (!d.dailyClothes && !d.privateClothes && !d.makeup) return '';
  var h = '<div class="iv-sec-title">外貌风格<em>STYLE DOSSIER</em></div>';
  h += '<div class="iv-sec"><div class="iv-style-row">';
  var cols = [
    { t: '日常着装', c: d.dailyClothes },
    { t: '私密衣着', c: d.privateClothes },
    { t: '妆容风格', c: d.makeup },
  ];
  for (var i = 0; i < cols.length; i++) {
    if (cols[i].c) h += '<div class="iv-style-col"><h4>' + esc(cols[i].t) + '</h4><p>' + esc(cols[i].c) + '</p></div>';
  }
  h += '</div></div>';
  return h;
}

function buildScore(label: string, sv: ScoreValue): string {
  var h = '<div class="iv-score">';
  h += '<div class="iv-score-row">';
  h += '<span class="iv-score-lbl">' + esc(label) + '</span>';
  h += '<div class="iv-score-bar"><div class="iv-score-fill" style="width:' + sv.score + '%"></div></div>';
  h += '<span class="iv-score-num">' + sv.score + '/100</span>';
  h += '</div>';
  if (sv.desc) h += '<div class="iv-score-desc">' + esc(sv.desc) + '</div>';
  h += '</div>';
  return h;
}

function buildTags(tags: string[], cls: string): string {
  var h = '<div class="iv-tags">';
  for (var i = 0; i < tags.length; i++) h += '<span class="iv-tag' + (cls ? ' ' + cls : '') + '">#' + esc(tags[i]) + '</span>';
  h += '</div>';
  return h;
}

function buildPsychology(d: InvestigationData): string {
  var h = '<div class="iv-sec-title">心理性向<em>PSYCH EVALUATION</em></div>';
  h += '<div class="iv-sec">';
  if (d.orientation) {
    h += '<div style="margin-bottom:12px;font-size:12.5px;"><span style="color:var(--iv-text-muted);">性取向</span>　<span style="color:var(--iv-text);font-weight:500;">' + esc(d.orientation) + '</span></div>';
  }
  if (d.shameIndex) h += buildScore('羞耻指数', d.shameIndex);
  if (d.confidenceIndex) h += buildScore('性自信指数', d.confidenceIndex);
  if (d.opennessIndex) h += buildScore('性开放度', d.opennessIndex);
  if (d.coreFetishes.length > 0) {
    h += '<div style="margin-top:12px;"><span style="font-size:10px;color:var(--iv-text-muted);letter-spacing:3px;text-transform:uppercase;">核心性癖</span>';
    h += '<div style="margin-top:6px;">' + buildTags(d.coreFetishes, '') + '</div></div>';
  }
  h += '</div>';
  return h;
}

function buildPurity(d: InvestigationData): string {
  var h = '<div class="iv-sec-title">纯洁档案<em>PURITY RECORD</em></div>';
  h += '<div class="iv-sec">';
  var purityMatch = d.purityScore.match(/(\d+)/);
  var purityVal = purityMatch ? parseInt(purityMatch[1], 10) : 0;
  var ringColor = purityRingColor(purityVal);

  h += '<div class="iv-style-row" style="align-items:center;">';
  h += '<div style="flex:0 0 auto;padding-right:24px;">';
  h += '<div class="iv-pure-ring-wrap">';
  h += '<div class="iv-pure-ring" style="border-color:' + ringColor + ';color:' + ringColor + ';">' + purityVal + '%</div>';
  h += '<div class="iv-pure-lbl">纯洁评分</div>';
  h += '</div></div>';

  h += '<div class="iv-pure-info">';
  if (d.isVirgin) h += '<div class="iv-pure-info-row"><span class="lbl">贞洁状态</span><span class="val">' + esc(d.isVirgin) + '</span></div>';
  if (d.defloration && d.defloration !== '无') {
    h += '<div class="iv-pure-info-row"><span class="lbl">初夜记录</span><span class="val" style="color:var(--iv-text-sub);font-weight:400;">' + esc(d.defloration) + '</span></div>';
  } else if (d.defloration === '无') {
    h += '<div class="iv-pure-info-row"><span class="lbl">初夜记录</span><span class="val" style="color:var(--iv-text-muted);">尚无</span></div>';
  }
  h += '</div></div>';

  // 部位纯洁明细 — 横向行布局
  if (d.purityDetails) {
    h += '<div style="margin-top:16px;font-size:9px;color:var(--iv-text-muted);letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">部位纯洁明细</div>';
    h += '<div class="iv-pd-list">';
    var detailLines = d.purityDetails.split(/[-\n]/).map(function (l) { return l.trim(); }).filter(Boolean);
    for (var i = 0; i < detailLines.length; i++) {
      var line = detailLines[i];
      var isLost = line.indexOf('已失') >= 0;
      var colonIdx = line.search(/[：:]/);
      var partName = '', partData = '';
      if (colonIdx >= 0) {
        partName = line.substring(0, colonIdx).trim();
        var raw = line.substring(colonIdx + 1).trim();
        var dataMatch = raw.match(/[已未]失\s*[（(]([^)）]+)[)）]/);
        if (dataMatch) partData = dataMatch[1];
      } else { partName = line; }
      h += '<div class="iv-pd-row">';
      h += '<span class="iv-pd-name">' + esc(partName) + '</span>';
      h += '<span class="iv-badge ' + (isLost ? 'lost' : 'pure') + '">' + (isLost ? '已失' : '未失') + '</span>';
      h += '<span class="iv-pd-data">' + (partData ? esc(partData) : '') + '</span>';
      h += '</div>';
    }
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function buildSexStats(d: InvestigationData): string {
  var h = '<div class="iv-sec-title">性爱统计<em>SEXUAL STATISTICS</em></div>';
  h += '<div class="iv-sec">';
  h += '<div class="iv-stat-cards">';
  if (d.sexCount) h += '<div class="iv-stat-card"><div class="iv-stat-num">' + esc(extractLeadingNumber(d.sexCount) || d.sexCount) + '</div><div class="iv-stat-lbl">总次数</div></div>';
  if (d.partnerCount || d.partnerGenderRatio) h += '<div class="iv-stat-card"><div class="iv-stat-num">' + esc(objectCountNumber(d.partnerCount, d.partnerGenderRatio)) + '</div><div class="iv-stat-lbl">人数</div>' + objectGenderSubLine(d.partnerGenderRatio, d.partnerCount) + '</div>';
  if (d.frequency) h += '<div class="iv-stat-card"><div style="font-size:15px;font-weight:700;color:var(--iv-red);">' + esc(d.frequency) + '</div><div class="iv-stat-lbl">频率</div></div>';
  h += '</div>';
  if (d.partnerList.length > 0) {
    h += '<div style="margin-top:12px;"><span style="font-size:9px;color:var(--iv-text-muted);letter-spacing:3px;text-transform:uppercase;">性伴名单</span>';
    h += '<table class="iv-tbl" style="margin-top:4px;"><thead><tr><th>姓名</th><th>身份</th><th>关系</th><th>强迫</th><th>占比</th></tr></thead><tbody>';
    for (var i = 0; i < d.partnerList.length; i++) {
      var p = d.partnerList[i];
      h += '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.identity) + '</td><td>' + esc(p.relationship) + '</td><td>' + esc(p.forced) + '</td><td>' + esc(p.percentage) + '</td></tr>';
    }
    h += '</tbody></table></div>';
  }
  // 环状比例图 — 机密档案风格配色
  // 提亮 3 个原深色（绿/蓝/紫）使环状扇形在浅/深底均可达 AA 区分（深色原约 1.5-2.5:1）
  var ringColors = ['#b5362e','#8b6d30','#4a9a74','#c08040','#5a90b0','#8a6ab0','#9a6040','#6a8090'];
  if (d.positionItems.length > 0) h += '<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(128,128,128,0.08)"><span style="font-size:9px;color:var(--iv-text-muted);letter-spacing:3px;text-transform:uppercase">常用体位</span>' + renderDonutChart(d.positionItems, ringColors, 90, 0.42) + '</div>';
  if (d.locationItems.length > 0) h += '<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(128,128,128,0.08)"><span style="font-size:9px;color:var(--iv-text-muted);letter-spacing:3px;text-transform:uppercase">场所分布</span>' + renderDonutChart(d.locationItems, ringColors, 90, 0.42) + '</div>';
  h += '</div>';
  return h;
}

function buildDevSection(d: InvestigationData): string {
  var devFields: Array<[string, string]> = [
    ['口部开发', d.devMouth], ['手部开发', d.devHand], ['足部开发', d.devFoot],
    ['乳部开发', d.devBreast], ['阳具开发', d.devPenis], ['阴部开发', d.devVagina],
    ['肛部开发', d.devAnal],
  ];
  // 过滤掉空值和不适用
  var active: Array<[string, string]> = [];
  for (var i = 0; i < devFields.length; i++) {
    var v = devFields[i][1];
    if (v && v !== '不适用') active.push(devFields[i]);
  }
  if (active.length === 0) return '';

  var h = '<div class="iv-sec-title">开发状态<em>DEVELOPMENT STATUS</em></div>';
  h += '<div class="iv-sec">';
  for (var i = 0; i < active.length; i++) {
    h += '<div class="iv-dev-row">';
    h += '<span class="iv-dev-label">' + esc(active[i][0]) + '</span>';
    h += '<span class="iv-dev-body">' + boldNumbers(esc(active[i][1])) + '</span>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function buildReproduction(d: InvestigationData): string {
  if (!hasPositiveCount(d.pregnancy) && !hasPositiveCount(d.impregnate)) return '';
  var h = '<div class="iv-sec-title">生育记录<em>REPRODUCTION</em></div>';
  h += '<div class="iv-sec">';
  if (hasPositiveCount(d.pregnancy)) {
    h += '<div style="margin-bottom:8px;font-size:12.5px;"><span style="color:var(--iv-text-muted);">孕产记录</span>　<span style="color:var(--iv-text);font-weight:600;">' + esc(d.pregnancy) + '</span></div>';
    if (d.pregnancyDetails && d.pregnancyDetails !== '无') h += '<div style="font-size:12px;color:var(--iv-text-sub);line-height:1.75;margin-bottom:10px;">' + esc(d.pregnancyDetails) + '</div>';
  }
  if (hasPositiveCount(d.impregnate)) {
    h += '<div style="margin-bottom:8px;font-size:12.5px;"><span style="color:var(--iv-text-muted);">使人怀孕</span>　<span style="color:var(--iv-text);font-weight:600;">' + esc(d.impregnate) + '</span></div>';
    if (d.impregnateDetails && d.impregnateDetails !== '无') h += '<div style="font-size:12px;color:var(--iv-text-sub);line-height:1.75;">' + esc(d.impregnateDetails) + '</div>';
  }
  h += '</div>';
  return h;
}

function buildMasturbation(d: InvestigationData): string {
  if (!d.mastCount && !d.mastFreq && !d.mastFirst && !d.mastWay) return '';
  var h = '<div class="iv-sec-title">自慰档案<em>MASTURBATION</em></div>';
  h += '<div class="iv-sec">';
  if (d.mastCount && d.mastCount !== '无') h += '<div style="margin-bottom:4px;font-size:12.5px;"><span style="color:var(--iv-text-muted);">总计</span>　<span style="color:var(--iv-text);font-weight:600;">' + esc(d.mastCount) + '</span></div>';
  if (d.mastFreq && d.mastFreq !== '无') h += '<div style="margin-bottom:12px;font-size:12.5px;"><span style="color:var(--iv-text-muted);">频率</span>　<span style="color:var(--iv-text);font-weight:600;">' + esc(d.mastFreq) + '</span></div>';
  h += '<div class="iv-exp-wrap">';
  if (d.mastFirst && d.mastFirst !== '无') h += '<div class="iv-exp-item"><h4>第一次自慰</h4><p>' + esc(d.mastFirst) + '</p></div>';
  if (d.mastWay && d.mastWay !== '无') h += '<div class="iv-exp-item"><h4>常用方式</h4><p>' + esc(d.mastWay) + '</p></div>';
  h += '</div></div>';
  return h;
}

function buildExperiences(d: InvestigationData): string {
  if (!d.firstExp && !d.lastExp && !d.bestExp) return '';
  var h = '<div class="iv-sec-title">性经历档案<em>EXPERIENCE</em></div>';
  h += '<div class="iv-sec"><div class="iv-exp-wrap">';
  var exps: Array<[string, string]> = [['初体验', d.firstExp], ['最近一次', d.lastExp], ['最爽一次', d.bestExp]];
  for (var i = 0; i < exps.length; i++) {
    var c = exps[i][1];
    if (c && c !== '无' && c !== '暂无数据') h += '<div class="iv-exp-item"><h4>' + esc(exps[i][0]) + '</h4><p>' + esc(c) + '</p></div>';
  }
  h += '</div></div>';
  return h;
}

function buildAssessment(d: InvestigationData): string {
  var h = '<div class="iv-sec-title">综合评估<em>ASSESSMENT</em></div>';
  h += '<div class="iv-sec">';

  if (d.charmTypes.length > 0) {
    h += '<div style="margin-bottom:10px;"><span style="font-size:9px;color:var(--iv-text-muted);letter-spacing:3px;text-transform:uppercase;">魅力类型</span>';
    h += '<div style="margin-top:5px;">' + buildTags(d.charmTypes, 'charm') + '</div></div>';
  }
  if (d.pornTags.length > 0) {
    h += '<div style="margin-bottom:12px;"><span style="font-size:9px;color:var(--iv-text-muted);letter-spacing:3px;text-transform:uppercase;">色情分类</span>';
    h += '<div style="margin-top:5px;">' + buildTags(d.pornTags, '') + '</div></div>';
  }

  if (d.rankAdvantages) {
    h += '<div style="margin-bottom:6px;font-size:12px;line-height:1.7;">';
    h += '<span class="iv-rank-pro">▲ 排名优势</span><br>';
    h += '<span style="color:var(--iv-text-sub);">' + esc(d.rankAdvantages) + '</span></div>';
  }
  if (d.rankDisadvantages) {
    h += '<div style="margin-bottom:12px;font-size:12px;line-height:1.7;">';
    h += '<span class="iv-rank-con">▼ 排名劣势</span><br>';
    h += '<span style="color:var(--iv-text-sub);">' + esc(d.rankDisadvantages) + '</span></div>';
  }

  if (d.bestPart) h += '<div style="margin-bottom:8px;font-size:12.5px;"><span style="color:var(--iv-text-muted);">最具吸引力部位</span>　<span style="color:var(--iv-text);font-weight:500;">' + esc(d.bestPart) + '</span></div>';
  if (d.voice) h += '<div style="margin-bottom:12px;font-size:12.5px;"><span style="color:var(--iv-text-muted);">声音档案</span><div style="color:var(--iv-text-sub);margin-top:4px;line-height:1.7;">' + esc(d.voice).replace(/\n/g, '<br>') + '</div></div>';

  if (d.reviews) {
    h += '<div style="margin-top:8px;"><span style="font-size:9px;color:var(--iv-text-muted);letter-spacing:3px;text-transform:uppercase;">流言</span>';
    h += '<div class="iv-rev-list" style="margin-top:6px;">';
    var reviewLines = d.reviews.split(/[-\n]/).map(function (l) { return l.trim(); }).filter(Boolean);
    for (var i = 0; i < reviewLines.length; i++) {
      var line = reviewLines[i];
      var colonIdx = line.search(/[：:]/);
      if (colonIdx > 0) {
        var reviewer = line.substring(0, colonIdx).trim();
        var text = line.substring(colonIdx + 1).trim();
        h += '<div class="iv-rev"><strong>' + esc(reviewer) + '</strong>：<span class="qt">「</span>' + esc(text) + '<span class="qt">」</span></div>';
      } else {
        h += '<div class="iv-rev"><span class="qt">「</span>' + esc(line) + '<span class="qt">」</span></div>';
      }
    }
    h += '</div></div>';
  }

  if (d.protagonistNote) {
    h += '<div style="margin-top:10px;padding:8px 12px;background:var(--iv-card-alt);border-left:3px solid var(--iv-red);font-size:13px;font-family:\'Noto Sans SC\',\'PingFang SC\',\'Microsoft YaHei\',sans-serif;color:var(--iv-text-sub);line-height:1.6">' + esc(d.protagonistNote) + '</div>';
  }

  if (d.characterSelfNote) {
    h += '<div style="margin-top:8px;padding:8px 12px;background:var(--iv-card-alt);border-left:3px solid var(--iv-gold);font-size:13px;font-family:\'Noto Sans SC\',\'PingFang SC\',\'Microsoft YaHei\',sans-serif;color:var(--iv-text-sub);line-height:1.6">' + esc(d.characterSelfNote) + '</div>';
  }

  h += '</div>';
  return h;
}

// ===================================================================
// 主导出
// ===================================================================

export function renderInvestigationHTML(data: InvestigationData, charName: string, isInvestigating?: boolean): string {
  var css = buildCSS();
  var body = '';
  body += buildHero(data);
  body += buildBasic(data);
  body += buildStyle(data);
  body += buildPsychology(data);
  body += buildPurity(data);
  body += buildSexStats(data);
  body += buildReproduction(data);
  body += buildDevSection(data);
  body += buildMasturbation(data);
  body += buildExperiences(data);
  body += buildAssessment(data);

  // 顶部操作栏嵌入档案内容首行
  var topBar = '<div class="iv-top-bar">' +
    '<span class="iv-name">' + esc(charName) + '</span>' +
    '<div class="iv-btns">' +
    '<button class="iv-top-btn" id="investigationRegenerateBtn" data-name="' + esc(charName) + '"' + (isInvestigating?' disabled':'') + '>' + (isInvestigating?'调查中...':'再次生成') + '</button>' +
    '<button class="iv-top-btn" id="investigationDeleteBtn" data-name="' + esc(charName) + '">清除全部档案</button>' +
    '<button class="iv-top-close" id="panelClose">&times;</button>' +
    '</div>' +
    '</div>';

  return '<style>' + css + '</style>' +
    '<div class="iv-popup">' +
    '<div class="iv-popup-body">' +
    '<div class="iv-wrap">' + topBar + body + '</div>' +
    '</div>' +
    '</div>';
}
