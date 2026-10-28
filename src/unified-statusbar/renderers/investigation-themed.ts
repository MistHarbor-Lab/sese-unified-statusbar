// ===== 五风格大调查档案主题渲染器 =====
// 每个风格拥有完全独立的结构、排版、配色、装饰、动画
import type { InvestigationData, ScoreValue } from '../core/investigation-parser';
import { renderDonutChart, renderStackedBar, renderTerminalBars, renderThinBars, extractLeadingNumber, objectCountNumber, objectGenderRatioText, objectGenderSubLine } from '../core/investigation-parser';
import { escapeHtml as esc } from '../core/html-escape';
import { ivStyleOnce } from './style-once';

function bn(text: string): string {
  return text.replace(/(\d+(?:\.\d+)?)/g,'<b>$1</b>');
}
/** 计数字段是否为正数(>0);"0次"/"无"/空 视为 0 → false;含正数 → true。用于生育块按次数显隐 */
function hasPositiveCount(s: string): boolean {
  if (!s) return false;
  const m = String(s).match(/\d+(?:\.\d+)?/);
  return !!(m && parseFloat(m[0]) > 0);
}
function ageColor(ageStr: string, young: string, prime: string, mature: string, senior: string): string {
  const a = parseInt(ageStr,10);
  if (isNaN(a)) return '';
  if (a<=18) return young; if (a<=25) return prime; if (a<=30) return mature; return senior;
}

// ===================================================================
// 🏮 古风 — 卷宗密档
// ===================================================================
export function renderAncientDossier(data: InvestigationData, charName: string): string {
  const css = `
/* 古风卷宗 — 亮色 */
.iv-wrap{font-family:var(--ub-font-reading);background:linear-gradient(180deg,#faf3e6 0%,#f0e6d0 50%,#f5edd8 100%);color:#3c2816;line-height:1.9;font-size:13.5px;position:relative;overflow:hidden}
.iv-wrap::before{content:"";position:absolute;top:0;bottom:0;left:32px;width:1px;background:repeating-linear-gradient(0deg,transparent,transparent 18px,rgba(180,140,100,0.15) 18px,rgba(180,140,100,0.15) 19px)}
.iv-wrap::after{content:"";position:absolute;top:0;bottom:0;right:32px;width:1px;background:repeating-linear-gradient(0deg,transparent,transparent 18px,rgba(180,140,100,0.15) 18px,rgba(180,140,100,0.15) 19px)}
.iv-popup-body{padding:0;overflow-y:auto;overflow-x:hidden;position:relative}
/* 顶部卷轴杆 */
.iv-scroll-rod{height:8px;background:linear-gradient(180deg,#c8a878 0%,#d4b888 40%,#b89460 60%,#a07848 100%);border-radius:0;margin:0 20px 16px;box-shadow:0 2px 8px rgba(100,60,20,0.2);position:relative}
.iv-scroll-rod::after{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:rgba(255,255,255,0.2)}
/* 卷宗头 */
.iv-dossier-header{text-align:center;padding:0 48px 20px;position:relative}
.iv-dossier-stamp{display:inline-block;border:3px double #b5362e;padding:6px 20px;margin-bottom:12px;color:#b5362e;font-size:18px;font-weight:700;letter-spacing:8px;position:relative;transform:rotate(-2deg);animation:iv-stamp 0.6s cubic-bezier(0.34,1.56,0.64,1);text-shadow:0 0 6px rgba(181,54,46,0.3),0 0 2px rgba(181,54,46,0.15)}
@keyframes iv-stamp{0%{transform:rotate(-2deg) scale(3);opacity:0;filter:blur(2px)}60%{transform:rotate(1deg) scale(0.9);filter:blur(0)}100%{transform:rotate(-2deg) scale(1);opacity:1;filter:blur(0)}}
.iv-dossier-stamp::before{content:"";position:absolute;top:-4px;left:-4px;right:-4px;bottom:-4px;border:1px solid #b5362e;opacity:0.5}
.iv-dossier-stamp::after{content:"";position:absolute;top:-1px;left:-1px;right:-1px;bottom:-1px;border:1px solid rgba(181,54,46,0.3);filter:blur(0.5px);pointer-events:none}
/* 丝带绑结 */
.iv-ribbon{position:absolute;top:-14px;width:6px;height:28px;background:linear-gradient(180deg,#c8a878,#b89460);z-index:2}
.iv-ribbon::after{content:"";position:absolute;bottom:-8px;left:50%;transform:translateX(-50%) rotate(45deg);width:10px;height:10px;background:#b89460;clip-path:polygon(50% 100%,0 0,100% 0)}
.iv-ribbon-l{left:52px}.iv-ribbon-r{right:52px}
.iv-dossier-title{font-size:13px;color:#8b6d30;letter-spacing:4px;margin-bottom:4px}
.iv-dossier-name{font-size:28px;font-weight:700;color:#2c1810;letter-spacing:6px;margin-bottom:4px}
.iv-dossier-grade{display:inline-block;background:#b5362e;color:#f5e6d0;padding:2px 18px;font-size:14px;font-weight:700;letter-spacing:6px;transform:rotate(-1deg);box-shadow:3px 3px 0 #6b1a0e;margin-top:4px}
.iv-dossier-rank{font-size:11px;color:#8b6d30;letter-spacing:4px;margin-top:6px}
.iv-dossier-desc{font-size:12px;color:#5c4a2e;line-height:1.85;max-width:620px;margin:10px auto 0;text-align:justify;text-indent:2em;font-style:italic;padding:10px 16px;border-left:3px solid #b5362e;background:rgba(181,54,46,0.04)}
/* 卷 = 章节 */
.iv-scroll-section{margin:0 40px 16px;padding:16px 20px;background:rgba(255,252,245,0.7);border:1px solid #d8cfb8;position:relative}
.iv-scroll-section::before{content:"";position:absolute;top:0;left:0;width:24px;height:24px;border-top:2px solid #b5362e;border-left:2px solid #b5362e;opacity:0.4}
.iv-section-label{font-size:10px;color:#b5362e;letter-spacing:4px;border-bottom:1px solid #d8cfb8;padding-bottom:8px;margin-bottom:12px;display:flex;align-items:center;gap:8px;position:relative}
.iv-section-label::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,#d8cfb8,transparent)}
.iv-section-label .num{display:inline-block;border:1px solid #b5362e;width:22px;height:22px;line-height:22px;text-align:center;font-size:11px;color:#b5362e}
/* 基本信息行 */
.iv-basic-row{display:flex;gap:24px;flex-wrap:wrap;font-size:13px;margin-bottom:10px}
.iv-basic-row .lbl{color:#8b6d30;font-size:10px;letter-spacing:2px;margin-right:4px}
.iv-basic-row .val{color:#3c2816;font-weight:500}
.iv-basic-body{font-size:12.5px;color:#5c4a2e;line-height:1.85;padding:8px 0}
/* 通用 label/value/body 内联色类（替代模板内 style="color:#xxx"，配 .dark 覆盖，根因 D） */
.iv-lbl{color:#8b6d30}
.iv-val{color:#3c2816;font-weight:500}
.iv-body{color:#5c4a2e}
/* 3列布局（外貌风格） */
.iv-3col{display:flex;gap:14px}
.iv-3col>div{flex:1;min-width:0}
.iv-3col h5{font-size:10px;color:#b5362e;letter-spacing:3px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px dotted #d8cfb8}
.iv-3col p{font-size:12px;color:#5c4a2e;line-height:1.75}
/* 评分条 */
.iv-score-row{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.iv-score-lbl{font-size:11px;color:#8b6d30;min-width:72px;text-align:right}
.iv-score-bar{flex:1;height:5px;background:#e8dcc8;position:relative;overflow:visible}
.iv-score-bar::after{content:"";position:absolute;right:-3px;top:-2px;width:9px;height:9px;border-radius:50%;background:#b5362e}
.iv-score-fill{height:100%;background:linear-gradient(90deg,#b5362e,#c0503a);position:relative;transition:width 0.8s ease}
.iv-score-num{font-size:14px;font-weight:700;color:#b5362e;min-width:40px;font-family:"Georgia",serif;position:relative}
.iv-score-num::before{content:"";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:30px;height:30px;border:1.5px solid rgba(181,54,46,0.25);border-radius:43% 57% 48% 52% / 46% 52% 48% 54%}
.iv-score-desc{font-size:10.5px;color:#8b6d30;margin-left:82px;margin-top:2px}
/* 标签 */
.iv-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.iv-tag{display:inline-block;padding:2px 10px;font-size:10px;letter-spacing:2px;border:1px solid #c04040;color:#8b1a12;background:rgba(181,54,46,0.04)}
.iv-tag.gold{color:#8b6d30;border-color:#8b6d30;background:rgba(139,109,48,0.06)}
/* 统计卡 */
.iv-stat-cards{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.iv-stat-card{flex:1;min-width:90px;text-align:center;padding:14px 8px;background:linear-gradient(180deg,#fefcf7,#f5e6d0);border:1px solid #d8cfb8;position:relative}
.iv-stat-card::after{content:"";position:absolute;bottom:4px;left:20%;right:20%;height:1px;background:#c04040;opacity:0.3}
.iv-stat-num{font-size:28px;font-weight:700;color:#b5362e;font-family:"Georgia",serif;line-height:1}
.iv-stat-lbl{font-size:9px;color:#8b6d30;letter-spacing:3px;margin-top:4px}
/* 表格 */
.iv-tbl{width:100%;border-collapse:collapse;font-size:11px}
.iv-tbl th{text-align:left;font-weight:500;color:#b5362e;font-size:9px;letter-spacing:2px;padding:5px 8px;border-bottom:1px solid #d8cfb8}
.iv-tbl td{padding:4px 8px;border-bottom:1px dotted #e8dcc8;color:#5c4a2e}
.iv-tbl tr:nth-child(even) td{background:rgba(181,54,46,0.02)}
/* 开发行 */
.iv-dev-row{display:flex;gap:10px;padding:8px 0;border-bottom:1px dotted #e8dcc8;align-items:flex-start}
.iv-dev-row:last-child{border-bottom:none}
.iv-dev-label{font-size:10px;color:#b5362e;font-weight:600;letter-spacing:3px;min-width:80px}
.iv-dev-body{font-size:12px;color:#5c4a2e;line-height:1.75;flex:1}
/* 经历时间线 */
.iv-exp-wrap{border-left:2px solid #d8cfb8;margin-left:8px;padding-left:16px;position:relative}
.iv-exp-item{margin-bottom:14px;position:relative}
.iv-exp-item::before{content:"";position:absolute;left:-23px;top:5px;width:8px;height:8px;border-radius:50%;background:#b5362e;border:2px solid #faf3e6}
.iv-exp-item h6{font-size:10px;color:#b5362e;letter-spacing:3px;margin-bottom:3px}
.iv-exp-item p{font-size:12px;color:#5c4a2e;line-height:1.75}
/* 评价 */
.iv-rev-list{display:flex;flex-direction:column;gap:4px}
.iv-rev{font-size:11.5px;color:#5c4a2e;padding:8px 12px;border-left:2px solid #d8cfb8;background:rgba(255,252,245,0.5);font-style:italic}
.iv-rev strong{color:#3c2816;font-style:normal}
/* 主角评价 / 角色自评 */
.iv-note-prot,.iv-note-self{font-family:"Noto Sans SC","Noto Sans CJK SC","Source Han Sans SC","PingFang SC","Microsoft YaHei","Heiti SC","WenQuanYi Micro Hei","PingFang SC","Microsoft YaHei",sans-serif;font-size:13px;line-height:1.6;padding:8px 14px;margin-top:8px;letter-spacing:0}
.iv-note-prot{border-left:3px solid #b5362e;background:rgba(181,54,46,0.04);color:#3c2816}
.iv-note-self{border-left:3px solid #8b6d30;background:rgba(139,109,48,0.06);color:#3c2816}
/* 纯洁环 */
.iv-pure-ring-wrap{text-align:center;padding:10px}
.iv-pure-ring{display:inline-flex;align-items:center;justify-content:center;width:80px;height:80px;border-radius:50%;font-size:22px;font-weight:800;font-family:"Georgia",serif;position:relative}
.iv-pure-ring::before{content:"密";position:absolute;top:-8px;left:50%;transform:translateX(-50%);font-size:8px;color:#b5362e;letter-spacing:0;font-weight:400;background:#faf3e6;padding:0 4px}
/* 响应式 */
@media(max-width:600px){.iv-3col{flex-direction:column}.iv-scroll-section{margin:0 20px 14px}.iv-dossier-header{padding:0 28px 16px}}
/* 暗色 — 古风深褐旧纸 */
.dark .iv-wrap{background:linear-gradient(180deg,#1e1810 0%,#221a12 50%,#1a140e 100%);color:#d0c8b0}
.dark .iv-age{filter:brightness(1.7)}
.dark .iv-wrap::before,.dark .iv-wrap::after{background:repeating-linear-gradient(0deg,transparent,transparent 18px,rgba(180,140,100,0.06) 18px,rgba(180,140,100,0.06) 19px)}
.dark .iv-scroll-section{background:rgba(30,24,16,0.6);border-color:#3a2e1a}
.dark .iv-scroll-section::before{border-color:#8b4a2e}
.dark .iv-section-label{color:#c06040;border-bottom-color:#3a2e1a}
.dark .iv-dossier-stamp{color:#c06040;border-color:#c06040}
.dark .iv-dossier-stamp::before{border-color:#c06040}
.dark .iv-dossier-name{color:#e0d8c0}
.dark .iv-dossier-title{color:#a08050}
.dark .iv-dossier-rank{color:#a08050}
.dark .iv-dossier-desc{color:#b0a080;border-left-color:#c06040;background:rgba(196,96,64,0.04)}
.dark .iv-basic-row .val{color:#d0c8b0}
.dark .iv-basic-body{color:#b0a080}
.dark .iv-3col h5{color:#c06040;border-bottom-color:#3a2e1a}
.dark .iv-3col p{color:#b0a080}
.dark .iv-score-bar{background:#2a2010}
.dark .iv-score-fill{background:linear-gradient(90deg,#c06040,#d0704a)}
.dark .iv-score-num{color:#c06040}
.dark .iv-score-num::before{border-color:rgba(192,96,64,0.3)}
.dark .iv-score-desc{color:#a08050}
.dark .iv-stat-card{background:linear-gradient(180deg,#221a12,#1e1810);border-color:#3a2e1a}
.dark .iv-stat-num{color:#c06040}
.dark .iv-stat-lbl{color:#a08050}
.dark .iv-tag{color:#c08060;border-color:#c08060;background:rgba(196,128,96,0.06)}
.dark .iv-tbl th{color:#c06040;border-bottom-color:#3a2e1a}
.dark .iv-tbl td{border-bottom-color:#2a2010;color:#b0a080}
.dark .iv-tbl tr:nth-child(even) td{background:rgba(196,96,64,0.02)}
.dark .iv-dev-label{color:#c06040}
.dark .iv-dev-body{color:#b0a080}
.dark .iv-dev-row{border-bottom-color:#2a2010}
.dark .iv-exp-wrap{border-left-color:#3a2e1a}
.dark .iv-exp-item::before{background:#c06040;border-color:#1e1810}
.dark .iv-exp-item p{color:#b0a080}
.dark .iv-rev{color:#b0a080;border-left-color:#3a2e1a;background:rgba(30,24,16,0.5)}
.dark .iv-rev strong{color:#d0c8b0}
.dark .iv-note-prot{color:#e8dcb8;background:rgba(181,54,46,0.12)}
.dark .iv-note-self{color:#e0d4b0;background:rgba(139,109,48,0.14)}
.dark .iv-pure-ring::before{background:#1e1810}
.dark .iv-dossier-grade{box-shadow:3px 3px 0 #4a1008}
.dark .iv-score-lbl{color:#a08050}
.dark .iv-lbl{color:#a08050}
.dark .iv-val{color:#d0c8b0}
.dark .iv-body{color:#b0a080}
.dark .iv-tag.gold{color:#c0a060;border-color:#c0a060;background:rgba(192,160,96,0.06)}
.dark .iv-basic-row .lbl{color:#a08050}
.dark .iv-exp-item h6{color:#c06040}
`;

  const sections: string[] = [];
  // 卷宗头
  sections.push('<div class="iv-dossier-header">');
  if (data.grade) sections.push('<div class="iv-dossier-stamp">密档 · ' + esc(data.grade) + '</div>');
  sections.push('<div class="iv-dossier-title">大理寺 · 秘卷</div>');
  sections.push('<div class="iv-dossier-name">' + esc(data.name||charName) + '</div>');
  if (data.globalRank) sections.push('<div class="iv-dossier-rank">天下第' + esc(extractLeadingNumber(data.globalRank)) + '名</div>');
  if (data.description) sections.push('<div class="iv-dossier-desc">' + esc(data.description) + '</div>');
  sections.push('</div>');

  // 基本档案
  sections.push('<div class="iv-scroll-section">');
  sections.push('<div class="iv-section-label"><span class="num">壹</span>基本档案</div>');
  if (data.sex || data.age) {
    const ac = ageColor(data.age,'#5a825a','#8b6d30','#c07830','#b5362e');
    sections.push('<div class="iv-basic-row">');
    if (data.sex) sections.push('<span><span class="lbl">性别</span><span class="val">' + esc(data.sex) + '</span></span>');
    if (data.age) sections.push('<span><span class="lbl">年岁</span><span class="val iv-age" style="color:'+ac+'">' + esc(data.age) + '</span></span>');
    sections.push('</div>');
  }
  if (data.body) sections.push('<div class="iv-basic-body">' + bn(esc(data.body)) + '</div>');
  sections.push('</div>');

  // 外貌风格
  if (data.dailyClothes||data.privateClothes||data.makeup) {
    sections.push('<div class="iv-scroll-section">');
    sections.push('<div class="iv-section-label"><span class="num">贰</span>外貌风格</div>');
    sections.push('<div class="iv-3col">');
    const cols = [{t:'日常着装',c:data.dailyClothes},{t:'私密衣着',c:data.privateClothes},{t:'妆容风格',c:data.makeup}];
    for (const col of cols) {
      if (col.c) sections.push('<div><h5>' + esc(col.t) + '</h5><p>' + esc(col.c) + '</p></div>');
    }
    sections.push('</div></div>');
  }

  // 心理性向
  sections.push('<div class="iv-scroll-section">');
  sections.push('<div class="iv-section-label"><span class="num">叁</span>心理性向</div>');
  if (data.orientation) sections.push('<div style="margin-bottom:10px;font-size:12px"><span class="iv-lbl">取向</span>　<span class="iv-val">' + esc(data.orientation) + '</span></div>');
  for (const [lbl,sv] of [['羞耻指数',data.shameIndex],['性自信',data.confidenceIndex],['性开放',data.opennessIndex]] as const) {
    if (sv) {
      sections.push('<div class="iv-score-row"><span class="iv-score-lbl">'+lbl+'</span><div class="iv-score-bar"><div class="iv-score-fill" style="width:'+sv.score+'%"></div></div><span class="iv-score-num">'+sv.score+'</span></div>');
      if (sv.desc) sections.push('<div class="iv-score-desc">' + esc(sv.desc) + '</div>');
    }
  }
  if (data.coreFetishes.length>0) {
    sections.push('<div style="margin-top:8px"><span class="iv-lbl" style="font-size:9px;letter-spacing:3px">核心性癖</span><div class="iv-tags">' + data.coreFetishes.map(t=>'<span class="iv-tag">#'+esc(t)+'</span>').join('') + '</div></div>');
  }
  sections.push('</div>');

  // 纯洁档案
  sections.push('<div class="iv-scroll-section">');
  sections.push('<div class="iv-section-label"><span class="num">肆</span>纯洁档案</div>');
  const purityMatch = data.purityScore.match(/(\d+)/);
  const purityVal = purityMatch?parseInt(purityMatch[1],10):0;
  const ringColor = purityVal<=25?'#b5362e':purityVal<=50?'#c07830':purityVal<=75?'#8b6d30':'#5a825a';
  sections.push('<div class="iv-3col" style="align-items:center"><div class="iv-pure-ring-wrap"><div class="iv-pure-ring" style="border:3px solid '+ringColor+';color:'+ringColor+'">'+purityVal+'%</div><div class="iv-lbl" style="font-size:9px;margin-top:4px">贞洁评分</div></div><div style="flex:1">');
  if (data.isVirgin) sections.push('<div style="font-size:12px;margin-bottom:4px"><span class="iv-lbl">状态</span>　<span class="iv-val">'+esc(data.isVirgin)+'</span></div>');
  if (data.defloration&&data.defloration!=='无') sections.push('<div class="iv-body" style="font-size:12px">' + esc(data.defloration) + '</div>');
  if (data.purityDetails) sections.push('<div class="iv-body" style="font-size:11.5px;margin-top:8px;padding-top:8px;border-top:1px dotted #d8cfb8;line-height:1.8">' + bn(esc(data.purityDetails)).replace(/\n/g,'<br>') + '</div>');
  sections.push('</div></div>');
  sections.push('</div>');

  // 性爱统计
  sections.push('<div class="iv-scroll-section">');
  sections.push('<div class="iv-section-label"><span class="num">伍</span>性爱统计</div>');
  sections.push('<div class="iv-stat-cards">');
  if (data.sexCount) sections.push('<div class="iv-stat-card"><div class="iv-stat-num">'+esc(extractLeadingNumber(data.sexCount)||data.sexCount)+'</div><div class="iv-stat-lbl">总次数</div></div>');
  if (data.partnerCount || data.partnerGenderRatio) sections.push('<div class="iv-stat-card"><div class="iv-stat-num">'+esc(objectCountNumber(data.partnerCount, data.partnerGenderRatio))+'</div><div class="iv-stat-lbl">人数</div>'+objectGenderSubLine(data.partnerGenderRatio, data.partnerCount)+'</div>');
  if (data.frequency) sections.push('<div class="iv-stat-card"><div style="font-size:16px;font-weight:700;color:#b5362e">'+esc(data.frequency)+'</div><div class="iv-stat-lbl">频率</div></div>');
  sections.push('</div>');
  // 墨条比例图 — 如毛笔横抹于宣纸
  var inkColors = ['#b5362e','#8b6d30','#4a7252','#c07830','#5b3a20','#4a6078','#8a6040','#b89840'];
  if (data.positionItems.length>0) sections.push('<div style="margin-top:14px;padding-top:12px;border-top:1px dotted #d8cfb8"><span class="iv-lbl" style="font-size:9px;letter-spacing:3px">常用体位</span>'+renderStackedBar(data.positionItems,inkColors,20)+'</div>');
  if (data.locationItems.length>0) sections.push('<div style="margin-top:10px;padding-top:10px;border-top:1px dotted #d8cfb8"><span class="iv-lbl" style="font-size:9px;letter-spacing:3px">场所分布</span>'+renderStackedBar(data.locationItems,inkColors,20)+'</div>');
  // 性伴名单
  if (data.partnerList.length>0) {
    sections.push('<div style="margin-top:14px;padding-top:12px;border-top:1px dotted #d8cfb8"><span class="iv-lbl" style="font-size:9px;letter-spacing:3px">性伴名册</span><div style="margin-top:6px;overflow-x:auto"><table class="iv-tbl"><thead><tr><th>姓名</th><th>身份</th><th>关系</th><th>强迫</th><th>占比</th></tr></thead><tbody>'
      + data.partnerList.map(function(p){return '<tr><td>'+esc(p.name)+'</td><td>'+esc(p.identity)+'</td><td>'+esc(p.relationship)+'</td><td>'+esc(p.forced)+'</td><td>'+esc(p.percentage)+'</td></tr>';}).join('')
      + '</tbody></table></div></div>');
  }
  sections.push('</div>');

  // 生育录
  if (hasPositiveCount(data.pregnancy) || hasPositiveCount(data.impregnate)) {
    sections.push('<div class="iv-scroll-section">');
    sections.push('<div class="iv-section-label"><span class="num">陆</span>生育录</div>');
    if (hasPositiveCount(data.pregnancy)) {
      sections.push('<div class="iv-dev-row"><span class="iv-dev-label">孕产</span><span class="iv-dev-body">'+bn(esc(data.pregnancy)).replace(/\n/g,'<br>')+'</span></div>');
      if (data.pregnancyDetails) sections.push('<div class="iv-dev-row"><span class="iv-dev-label">孕产明细</span><span class="iv-dev-body">'+bn(esc(data.pregnancyDetails)).replace(/\n/g,'<br>')+'</span></div>');
    }
    if (hasPositiveCount(data.impregnate)) {
      sections.push('<div class="iv-dev-row"><span class="iv-dev-label">使人怀孕</span><span class="iv-dev-body">'+bn(esc(data.impregnate)).replace(/\n/g,'<br>')+'</span></div>');
      if (data.impregnateDetails) sections.push('<div class="iv-dev-row"><span class="iv-dev-label">相关明细</span><span class="iv-dev-body">'+bn(esc(data.impregnateDetails)).replace(/\n/g,'<br>')+'</span></div>');
    }
    sections.push('</div>');
  }

  // 开发状态
  const devFields = ([
    ['口部',data.devMouth],['手部',data.devHand],['足部',data.devFoot],
    ['乳部',data.devBreast],['阳具',data.devPenis],['阴部',data.devVagina],['肛部',data.devAnal]
  ] as [string,string][]).filter(([,v])=>v&&v!=='不适用');
  if (devFields.length>0) {
    sections.push('<div class="iv-scroll-section">');
    sections.push('<div class="iv-section-label"><span class="num">柒</span>开发状态</div>');
    for (const [lbl,txt] of devFields) {
      sections.push('<div class="iv-dev-row"><span class="iv-dev-label">'+esc(lbl)+'</span><span class="iv-dev-body">'+bn(esc(txt))+'</span></div>');
    }
    sections.push('</div>');
  }

  // 经历
  const exps: [string,string][] = [['初次经历',data.firstExp],['最近一次',data.lastExp],['最爽一次',data.bestExp]];
  const validExps = exps.filter(([,v])=>v&&v!=='无'&&v!=='暂无数据');
  const hasExps = validExps.length>0;
  if (hasExps||data.mastFirst||data.mastWay||data.mastCount||data.mastFreq) {
    sections.push('<div class="iv-scroll-section">');
    sections.push('<div class="iv-section-label"><span class="num">捌</span>经历档案</div>');
    sections.push('<div class="iv-exp-wrap">');
    for (const [lbl,txt] of validExps) {
      sections.push('<div class="iv-exp-item"><h6>'+esc(lbl)+'</h6><p>'+esc(txt)+'</p></div>');
    }
    if (data.mastFirst&&data.mastFirst!=='无') sections.push('<div class="iv-exp-item"><h6>初次自慰</h6><p>'+esc(data.mastFirst)+'</p></div>');
    if (data.mastWay&&data.mastWay!=='无') sections.push('<div class="iv-exp-item"><h6>惯常方式</h6><p>'+esc(data.mastWay)+'</p></div>');
    sections.push('</div>');
    if (data.mastCount||data.mastFreq) {
      sections.push('<div style="margin-top:12px;padding-top:10px;border-top:1px dotted #d8cfb8;display:flex;gap:24px;flex-wrap:wrap;font-size:12px">');
      if (data.mastCount) sections.push('<span><span class="iv-lbl" style="font-size:10px;letter-spacing:2px">自慰次数</span>　<span class="iv-val">'+esc(data.mastCount)+'</span></span>');
      if (data.mastFreq) sections.push('<span><span class="iv-lbl" style="font-size:10px;letter-spacing:2px">自慰频率</span>　<span class="iv-val">'+esc(data.mastFreq)+'</span></span>');
      sections.push('</div>');
    }
    sections.push('</div>');
  }

  // 综合评估
  sections.push('<div class="iv-scroll-section">');
  sections.push('<div class="iv-section-label"><span class="num">玖</span>综合评估</div>');
  if (data.charmTypes.length>0) sections.push('<div style="margin-bottom:8px"><span class="iv-lbl" style="font-size:9px;letter-spacing:3px">魅力类型</span><div class="iv-tags" style="margin-top:4px">'+data.charmTypes.map(t=>'<span class="iv-tag gold">#'+esc(t)+'</span>').join('')+'</div></div>');
  if (data.pornTags.length>0) sections.push('<div style="margin-bottom:8px"><span class="iv-lbl" style="font-size:9px;letter-spacing:3px">色情分类</span><div class="iv-tags" style="margin-top:4px">'+data.pornTags.map(t=>'<span class="iv-tag">#'+esc(t)+'</span>').join('')+'</div></div>');
  if (data.bestPart) sections.push('<div style="font-size:12px;margin-bottom:4px"><span class="iv-lbl">最具吸引力部位</span>　<span class="iv-val">'+esc(data.bestPart)+'</span></div>');
  if (data.voice) sections.push('<div style="font-size:12px;margin-bottom:8px"><span class="iv-lbl">声音档案</span><div class="iv-body" style="margin-top:2px;line-height:1.7">'+esc(data.voice).replace(/\n/g,'<br>')+'</div></div>');
  if (data.rankAdvantages) sections.push('<div style="font-size:11px;color:#5a825a;margin-bottom:4px">▲ 优势　'+esc(data.rankAdvantages)+'</div>');
  if (data.rankDisadvantages) sections.push('<div style="font-size:11px;color:#b5362e;margin-bottom:8px">▼ 劣势　'+esc(data.rankDisadvantages)+'</div>');
  if (data.reviews) {
    sections.push('<div style="margin-top:8px"><span class="iv-lbl" style="font-size:9px;letter-spacing:3px">流言</span><div class="iv-rev-list" style="margin-top:4px">');
    const reviews = data.reviews.split(/[-\n]/).map(l=>l.trim()).filter(Boolean);
    for (const r of reviews) {
      const ci = r.search(/[：:]/);
      if (ci>0) sections.push('<div class="iv-rev"><strong>'+esc(r.substring(0,ci).trim())+'</strong>：「'+esc(r.substring(ci+1).trim())+'」</div>');
      else sections.push('<div class="iv-rev">「'+esc(r)+'」</div>');
    }
    sections.push('</div></div>');
  }
  if (data.protagonistNote) sections.push('<div class="iv-note-prot">✎ ' + esc(data.protagonistNote) + '</div>');
  if (data.characterSelfNote) sections.push('<div class="iv-note-self">✐ ' + esc(data.characterSelfNote) + '</div>');
  sections.push('</div>');

  // 底部卷轴杆
  const rodBot = '<div class="iv-scroll-rod" style="margin:0 20px 20px"></div>';

  return ivStyleOnce(css) +
    '<div class="iv-popup"><div class="iv-popup-body"><div class="iv-wrap">' +
    '<div style="position:relative"><div class="iv-ribbon iv-ribbon-l"></div><div class="iv-ribbon iv-ribbon-r"></div><div class="iv-scroll-rod"></div></div>' +
    sections.join('') +
    rodBot +
    '</div></div></div>';
}

// ===================================================================
// 💜 瑟瑟 — 霓虹密档 (Hacker Terminal)
// ===================================================================
export function renderFlirtatiousDossier(data: InvestigationData, charName: string): string {
  const css = `
/* 亮色终端（默认）— 浅灰紫底+深色文字 */
.iv-wrap{font-family:"Noto Sans SC","Noto Sans CJK SC","Source Han Sans SC","PingFang SC","Microsoft YaHei","Heiti SC","WenQuanYi Micro Hei",sans-serif;background:linear-gradient(180deg,#ece4f0 0%,#f2ecf6 50%,#ece4f0 100%);color:#3a2840;line-height:1.7;font-size:12.5px;position:relative;overflow:hidden;min-height:100%}
/* CRT扫描线覆层 */
.iv-wrap::after{content:"";position:absolute;top:0;left:0;right:0;bottom:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.015) 2px,rgba(0,0,0,0.015) 3px);pointer-events:none;z-index:100}
.iv-popup-body{overflow-y:auto;overflow-x:hidden;padding:0}
.iv-term-header{background:#e0d8e4;border-bottom:2px solid #c06080;padding:8px 16px;display:flex;align-items:center;gap:10px;font-size:10px;letter-spacing:1px;position:sticky;top:0;z-index:5}
/* 启动序列日志 */
.iv-boot-log{background:#1a1020;color:#a0d0a0;font-size:9px;line-height:1.6;padding:6px 16px;font-family:"Courier New",monospace;letter-spacing:0.5px;opacity:0.85;border-bottom:1px solid rgba(192,96,128,0.15)}
.iv-boot-log span{display:block}
.iv-boot-log .ok{color:#40d060}
.iv-boot-log .warn{color:#e0a040}
/* 数据流装饰线 */
.iv-data-panel{position:relative}
.iv-data-panel::before{content:"";position:absolute;left:0;top:0;bottom:0;width:1px;background:linear-gradient(180deg,transparent,#c06080 20%,#c06080 80%,transparent);animation:iv-datastream 3s linear infinite;opacity:0.3}
@keyframes iv-datastream{0%{background-position:0 100%}100%{background-position:0 -100%}}
.iv-term-dot{width:10px;height:10px;border-radius:50%}
.iv-term-dot.r{background:#d04060;box-shadow:0 0 6px #d04060}
.iv-term-dot.y{background:#d09030;box-shadow:0 0 6px #d09030}
.iv-term-dot.g{background:#40a060;box-shadow:0 0 6px #40a060}
.iv-term-title{flex:1;color:#b04060;text-align:center;font-weight:600}
.iv-term-sig{color:#8a7a90;font-size:9px}
.iv-neon-hero{padding:24px 20px 16px;text-align:center;border-bottom:1px solid rgba(192,96,128,0.15);position:relative}
.iv-neon-hero::after{content:"";position:absolute;bottom:0;left:10%;right:10%;height:1px;background:linear-gradient(90deg,transparent,#c06080,transparent)}
.iv-neon-id{font-size:9px;color:#8a7a90;letter-spacing:3px;margin-bottom:4px}
.iv-neon-name{font-size:30px;font-weight:700;color:#4a2040;letter-spacing:4px;margin-bottom:4px;position:relative}
/* Glitch 文字 — 偶发RGB通道分离 */
@keyframes iv-glitch{0%,94%,96%,100%{text-shadow:none;transform:none}95%{text-shadow:2px 0 #f00,-2px 0 #0ff;transform:translate(-1px,0)}}
.iv-neon-name{animation:iv-glitch 8s infinite}
.iv-neon-grade{display:inline-block;background:linear-gradient(135deg,#d06080,#a04060);color:#fff;padding:3px 20px;font-size:13px;font-weight:700;letter-spacing:6px;box-shadow:0 0 12px rgba(192,96,128,0.3);animation:iv-neon-pulse 2s ease-in-out infinite}
@keyframes iv-neon-pulse{0%,100%{box-shadow:0 0 12px rgba(192,96,128,0.3)}50%{box-shadow:0 0 20px rgba(192,96,128,0.5)}}
.iv-neon-rank{font-size:10px;color:#8a6a80;letter-spacing:3px;margin-top:6px}
.iv-neon-desc{font-size:12px;color:#5a3a50;line-height:1.7;max-width:600px;margin:10px auto 0;text-align:left;padding:12px 16px;background:rgba(192,96,128,0.04);border:1px solid rgba(192,96,128,0.1)}
.iv-data-panel{margin:0;padding:16px 20px;border-bottom:1px solid rgba(192,96,128,0.08)}
.iv-data-panel h3{font-size:9px;color:#c06080;letter-spacing:4px;text-transform:uppercase;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.iv-data-panel h3::before{content:">";color:#c06080;animation:iv-cursor 1s step-end infinite}
@keyframes iv-cursor{0%,100%{opacity:1}50%{opacity:0}}
.iv-data-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px}
.iv-data-item{font-size:11.5px}
.iv-data-item .lbl{color:#907080;font-size:9px;text-transform:uppercase;letter-spacing:2px}
.iv-data-item .val{color:#4a3040;font-weight:500}
/* 通用 value/body 内联色类（替代模板内联 #b0a0c0/#5a3a50，配 .dark 覆盖，根因 D） */
.iv-neon-val{color:#4a3040;font-weight:500}
.iv-neon-body{color:#5a3a50}
.iv-neon-bar-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.iv-neon-bar-lbl{color:#907080;font-size:10px;min-width:70px;text-align:right}
.iv-neon-bar{flex:1;height:4px;background:rgba(192,96,128,0.1);position:relative;overflow:visible;border-radius:2px}
.iv-neon-bar-fill{height:100%;background:linear-gradient(90deg,#d06080,#e080a0);border-radius:2px;box-shadow:0 0 6px rgba(192,96,128,0.3);transition:width 0.8s ease;position:relative}
.iv-neon-bar-num{font-size:13px;font-weight:700;color:#c06080;min-width:40px;font-family:"Courier New",monospace}
.iv-neon-bar-desc{font-size:9.5px;color:#907080;margin-left:80px;margin-top:2px}
.iv-neon-tags{display:flex;flex-wrap:wrap;gap:5px}
.iv-neon-tag{display:inline-block;padding:2px 10px;font-size:9.5px;letter-spacing:1px;border:1px solid rgba(192,96,128,0.3);color:#b04060;background:rgba(192,96,128,0.04);border-radius:2px}
.iv-neon-tag.alt{color:#7050a0;border-color:rgba(128,96,160,0.3);background:rgba(128,96,160,0.04)}
.iv-neon-stats{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.iv-neon-stat{flex:1;min-width:90px;text-align:center;padding:16px 8px;background:rgba(255,255,255,0.5);border:1px solid rgba(192,96,128,0.12);position:relative;overflow:hidden}
.iv-neon-stat::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(192,96,128,0.3),transparent)}
.iv-neon-stat .num{font-size:28px;font-weight:700;color:#c06080;font-family:"Courier New",monospace}
.iv-neon-stat .lbl{font-size:8px;color:#907080;letter-spacing:3px;text-transform:uppercase;margin-top:4px}
.iv-neon-tbl{width:100%;border-collapse:collapse;font-size:10.5px}
.iv-neon-tbl th{text-align:left;color:#c06080;font-size:8.5px;letter-spacing:2px;padding:5px 8px;border-bottom:1px solid rgba(192,96,128,0.15);text-transform:uppercase}
.iv-neon-tbl td{padding:4px 8px;border-bottom:1px solid rgba(192,96,128,0.05);color:#5a3a50}
.iv-neon-tbl tr:nth-child(even) td{background:rgba(192,96,128,0.02)}
.iv-neon-dev-row{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid rgba(192,96,128,0.05);align-items:flex-start}
.iv-neon-dev-row:last-child{border-bottom:none}
.iv-neon-dev-lbl{font-size:9.5px;color:#c06080;font-weight:600;letter-spacing:2px;min-width:80px;text-transform:uppercase}
.iv-neon-dev-body{font-size:11.5px;color:#5a3a50;line-height:1.7;flex:1}
.iv-neon-exp{border-left:1px solid rgba(192,96,128,0.2);margin-left:8px;padding-left:16px}
.iv-neon-exp-item{margin-bottom:12px;position:relative}
.iv-neon-exp-item::before{content:">>";position:absolute;left:-28px;top:0;color:#c06080;font-size:8px;opacity:0.5}
.iv-neon-exp-item h6{font-size:9.5px;color:#b04060;letter-spacing:2px;text-transform:uppercase;margin-bottom:2px}
.iv-neon-exp-item p{font-size:11.5px;color:#5a3a50;line-height:1.7}
.iv-neon-rev{padding:8px 12px;margin-bottom:4px;border-left:2px solid rgba(128,96,160,0.2);font-size:11px;color:#6a4a60}
.iv-neon-rev strong{color:#4a2040}
/* 主角评价 / 角色自评 */
.iv-note-prot,.iv-note-self{font-family:"Noto Sans SC","Noto Sans CJK SC","Source Han Sans SC","PingFang SC","Microsoft YaHei","Heiti SC","WenQuanYi Micro Hei","PingFang SC","Microsoft YaHei",sans-serif;font-size:13px;line-height:1.6;padding:8px 12px;margin-top:8px}
.iv-note-prot{border-left:3px solid #c06080;background:rgba(192,96,128,0.06);color:#4a2040}
.iv-note-self{border-left:3px solid #9050c0;background:rgba(144,80,192,0.06);color:#4a2060}
.iv-neon-pure{display:inline-flex;align-items:center;justify-content:center;width:80px;height:80px;border-radius:50%;font-size:20px;font-weight:700;font-family:"Courier New",monospace;position:relative}
.iv-neon-pure::after{content:"";position:absolute;top:-6px;left:-6px;right:-6px;bottom:-6px;border-radius:50%;border:1px solid currentColor;opacity:0.2;animation:iv-ring-spin 4s linear infinite}
@keyframes iv-ring-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
@media(max-width:600px){.iv-data-grid{grid-template-columns:1fr}}
/* 暗色霓虹终端 */
.dark .iv-wrap{background:#0a0a0f;color:#e0d0ff}
.dark .iv-wrap::after{background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.02) 2px,rgba(255,255,255,0.02) 3px)}
.dark .iv-term-header{background:#0d0d15;border-bottom-color:#ff6a9e}
.dark .iv-boot-log{background:#050510;color:#60c060;border-bottom-color:rgba(255,106,158,0.2)}
.dark .iv-term-title{color:#ff8ab0}
.dark .iv-term-sig{color:#6a6a8a}
.dark .iv-term-dot.r{background:#ff3b5c;box-shadow:0 0 6px #ff3b5c}
.dark .iv-term-dot.y{background:#ffb830;box-shadow:0 0 6px #ffb830}
.dark .iv-term-dot.g{background:#3bff6a;box-shadow:0 0 6px #3bff6a}
.dark .iv-neon-hero{border-bottom-color:rgba(255,106,158,0.2)}
.dark .iv-neon-hero::after{background:linear-gradient(90deg,transparent,#ff6a9e,transparent)}
.dark .iv-neon-id{color:#6a6a8a}
.dark .iv-neon-name{color:#fff;text-shadow:0 0 20px rgba(255,106,158,0.6),0 0 40px rgba(255,106,158,0.3)}
.dark .iv-neon-grade{background:linear-gradient(135deg,#ff6a9e,#c04480);box-shadow:0 0 15px rgba(255,106,158,0.4)}
.dark .iv-neon-rank{color:#c080c0}
.dark .iv-neon-desc{color:#b0a0c0;background:rgba(255,106,158,0.04);border-color:rgba(255,106,158,0.12)}
.dark .iv-data-panel{border-bottom-color:rgba(255,106,158,0.1)}
.dark .iv-data-panel h3{color:#ff6a9e}
.dark .iv-data-panel h3::before{color:#ff6a9e}
.dark .iv-data-item .lbl{color:#806090}
.dark .iv-data-item .val{color:#d0c0ff}
.dark .iv-neon-val{color:#d0c0ff}
.dark .iv-neon-body{color:#c0b0e0}
.dark .iv-neon-bar{background:rgba(255,106,158,0.15)}
.dark .iv-neon-bar-fill{background:linear-gradient(90deg,#ff6a9e,#ff8ab0);box-shadow:0 0 10px rgba(255,106,158,0.5)}
.dark .iv-neon-bar-num{color:#ff8ab0}
.dark .iv-neon-bar-desc{color:#806090}
.dark .iv-neon-tag{color:#ff8ab0;border-color:rgba(255,106,158,0.4);background:rgba(255,106,158,0.06)}
.dark .iv-neon-tag.alt{color:#c0a0ff;border-color:rgba(192,160,255,0.4);background:rgba(192,160,255,0.06)}
.dark .iv-neon-stat{background:rgba(10,10,20,0.8);border-color:rgba(255,106,158,0.2)}
.dark .iv-neon-stat::before{background:linear-gradient(90deg,transparent,rgba(255,106,158,0.4),transparent)}
.dark .iv-neon-stat .num{color:#ff8ab0;text-shadow:0 0 10px rgba(255,106,158,0.3)}
.dark .iv-neon-stat .lbl{color:#806090}
.dark .iv-neon-tbl th{color:#ff6a9e;border-bottom-color:rgba(255,106,158,0.2)}
.dark .iv-neon-tbl td{color:#b0a0c0;border-bottom-color:rgba(255,106,158,0.06)}
.dark .iv-neon-tbl tr:nth-child(even) td{background:rgba(255,106,158,0.02)}
.dark .iv-neon-dev-row{border-bottom-color:rgba(255,106,158,0.06)}
.dark .iv-neon-dev-lbl{color:#ff6a9e}
.dark .iv-neon-dev-body{color:#c0b0e0}
.dark .iv-neon-exp{border-left-color:rgba(255,106,158,0.3)}
.dark .iv-neon-exp-item::before{color:#ff6a9e;opacity:0.6}
.dark .iv-neon-exp-item h6{color:#ff8ab0}
.dark .iv-neon-exp-item p{color:#c0b0e0}
.dark .iv-neon-rev{color:#b0a0d0;border-left-color:rgba(192,160,255,0.3)}
.dark .iv-neon-rev strong{color:#d0c0ff}
.dark .iv-note-prot{color:#f0d8e8;background:rgba(192,96,128,0.14)}
.dark .iv-note-self{color:#e0d0f0;background:rgba(144,80,192,0.16)}
.dark .iv-neon-pure::after{opacity:0.3}
	/* 亮色 — 优势/劣势/纯洁度颜色（深色调，浅色背景清晰可读） */
	.iv-neon-adv{color:#217a3d}          /* 深绿 */
	.iv-neon-disadv{color:#c0303a}       /* 深红 */
	.iv-neon-pure-l0{color:#c0203a;border-color:#c0203a}  /* ≤25 深红 */
	.iv-neon-pure-l1{color:#c05070;border-color:#c05070}  /* ≤50 深粉 */
	.iv-neon-pure-l2{color:#7050a0;border-color:#7050a0}  /* ≤75 深紫 */
	.iv-neon-pure-l3{color:#217a3d;border-color:#217a3d}  /* >75 深绿 */
	/* 暗色 — 霓虹指标 */
	.dark .iv-neon-adv{color:#3bff6a}
	.dark .iv-neon-disadv{color:#ff3b5c}
	.dark .iv-neon-pure-l0{color:#ff3b5c;border-color:#ff3b5c}
	.dark .iv-neon-pure-l1{color:#ff8ab0;border-color:#ff8ab0}
	.dark .iv-neon-pure-l2{color:#c0a0ff;border-color:#c0a0ff}
	.dark .iv-neon-pure-l3{color:#3bff6a;border-color:#3bff6a}
`;

  const parts: string[] = [];
  // 终端头
  parts.push('<div class="iv-term-header">');
  parts.push('<span class="iv-term-dot r"></span><span class="iv-term-dot y"></span><span class="iv-term-dot g"></span>');
  parts.push('<span class="iv-term-title">NEON_DOSSIER.exe</span>');
  parts.push('<span class="iv-term-sig">SIG:'+Math.random().toString(36).slice(2,8).toUpperCase()+'</span>');
  parts.push('</div>');
  // 启动序列日志
  parts.push('<div class="iv-boot-log"><span>> INIT_SEQUENCE...</span><span>> DECRYPTING_DATABASE... <span class="ok">OK</span></span><span>> ACCESS_LEVEL: <span class="warn">RESTRICTED</span></span><span>> ACCESS_GRANTED // SESSION_'+Math.random().toString(36).slice(2,6).toUpperCase()+'</span></div>');

  // 主角
  parts.push('<div class="iv-neon-hero">');
  parts.push('<div class="iv-neon-id">SUBJECT_ID // '+esc(charName).toUpperCase()+'</div>');
  parts.push('<div class="iv-neon-name">'+esc(data.name||charName)+'</div>');
  if (data.grade) parts.push('<div class="iv-neon-grade">'+esc(data.grade)+'</div>');
  if (data.globalRank) parts.push('<div class="iv-neon-rank">GLOBAL RANK: '+esc(data.globalRank)+'</div>');
  if (data.description) parts.push('<div class="iv-neon-desc">'+esc(data.description)+'</div>');
  parts.push('</div>');

  // 基本数据
  parts.push('<div class="iv-data-panel"><h3>BASIC_DATA</h3>');
  parts.push('<div class="iv-data-grid">');
  if (data.sex) parts.push('<div class="iv-data-item"><div class="lbl">Gender</div><div class="val">'+esc(data.sex)+'</div></div>');
  if (data.age) parts.push('<div class="iv-data-item"><div class="lbl">Age</div><div class="val">'+esc(data.age)+'</div></div>');
  if (data.body) parts.push('<div class="iv-data-item" style="grid-column:1/-1"><div class="lbl">Body</div><div class="val">'+bn(esc(data.body))+'</div></div>');
  parts.push('</div></div>');

  // 外貌风格
  if (data.dailyClothes||data.privateClothes||data.makeup) {
    parts.push('<div class="iv-data-panel"><h3>STYLE_PROFILE</h3><div class="iv-data-grid">');
    for (const [lbl,val] of [['Daily',data.dailyClothes],['Private',data.privateClothes],['Makeup',data.makeup]] as const) {
      if (val) parts.push('<div class="iv-data-item"><div class="lbl">'+lbl+'</div><div class="val">'+esc(val)+'</div></div>');
    }
    parts.push('</div></div>');
  }

  // 心理
  parts.push('<div class="iv-data-panel"><h3>PSYCH_SCAN</h3>');
  if (data.orientation) parts.push('<div class="iv-neon-val" style="font-size:11px;margin-bottom:8px"><span style="color:#806090">ORIENTATION</span> '+esc(data.orientation)+'</div>');
  for (const [lbl,sv] of [['SHAME',data.shameIndex],['CONFIDENCE',data.confidenceIndex],['OPENNESS',data.opennessIndex]] as const) {
    if (sv) {
      parts.push('<div class="iv-neon-bar-row"><span class="iv-neon-bar-lbl">'+lbl+'</span><div class="iv-neon-bar"><div class="iv-neon-bar-fill" style="width:'+sv.score+'%"></div></div><span class="iv-neon-bar-num">'+sv.score+'</span></div>');
      if (sv.desc) parts.push('<div class="iv-neon-bar-desc">'+esc(sv.desc)+'</div>');
    }
  }
  if (data.coreFetishes.length>0) {
    parts.push('<div style="margin-top:8px"><span style="font-size:8px;color:#806090;letter-spacing:2px">FETISHES</span><div class="iv-neon-tags" style="margin-top:4px">'+data.coreFetishes.map(t=>'<span class="iv-neon-tag">#'+esc(t)+'</span>').join('')+'</div></div>');
  }
  parts.push('</div>');

  // 纯洁
  parts.push('<div class="iv-data-panel"><h3>PURITY_CHECK</h3>');
	  const pMatch = data.purityScore.match(/(\d+)/);
	  const pv = pMatch?parseInt(pMatch[1],10):0;
	  const rcClass = 'iv-neon-pure-l'+(pv<=25?0:pv<=50?1:pv<=75?2:3);
	  parts.push('<div style="display:flex;align-items:center;gap:20px"><div class="iv-neon-pure '+rcClass+'">'+pv+'%</div><div style="flex:1">');
  if (data.isVirgin) parts.push('<div class="iv-neon-val" style="font-size:11px"><span style="color:#806090">STATUS:</span> '+esc(data.isVirgin)+'</div>');
  if (data.defloration&&data.defloration!=='无') parts.push('<div class="iv-neon-val" style="font-size:11px;margin-top:4px">'+esc(data.defloration)+'</div>');
  if (data.purityDetails) parts.push('<div class="iv-neon-body" style="font-size:10.5px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(192,96,128,0.1);line-height:1.7">'+bn(esc(data.purityDetails)).replace(/\n/g,'<br>')+'</div>');
  parts.push('</div></div></div>');

  // 性爱统计
  parts.push('<div class="iv-data-panel"><h3>SEX_STATS</h3>');
  parts.push('<div class="iv-neon-stats">');
  if (data.sexCount) parts.push('<div class="iv-neon-stat"><div class="num">'+esc(extractLeadingNumber(data.sexCount)||data.sexCount)+'</div><div class="lbl">Total</div></div>');
  if (data.partnerCount || data.partnerGenderRatio) parts.push('<div class="iv-neon-stat"><div class="num">'+esc(objectCountNumber(data.partnerCount, data.partnerGenderRatio))+'</div><div class="lbl">Partners</div>'+objectGenderSubLine(data.partnerGenderRatio, data.partnerCount)+'</div>');
  if (data.frequency) parts.push('<div class="iv-neon-stat"><div class="num" style="font-size:15px;font-weight:700">'+esc(data.frequency)+'</div><div class="lbl">Frequency</div></div>');
  parts.push('</div>');
  // 终端进度条 — htop 风格 ASCII 比例条
  var termColors = ['#d04060','#e060a0','#9050c0','#3090b0','#e08040','#40a060','#c04080','#d09040'];
  if (data.positionItems.length>0) parts.push('<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(192,96,128,0.1)"><span style="font-size:8px;color:#806090;letter-spacing:3px">POSITIONS</span>'+renderTerminalBars(data.positionItems,termColors,30)+'</div>');
  if (data.locationItems.length>0) parts.push('<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(192,96,128,0.1)"><span style="font-size:8px;color:#806090;letter-spacing:3px">LOCATIONS</span>'+renderTerminalBars(data.locationItems,termColors,30)+'</div>');
  // 性伴名单
  if (data.partnerList.length>0) {
    parts.push('<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(192,96,128,0.1)"><span style="font-size:8px;color:#806090;letter-spacing:3px">PARTNER_LIST</span><div style="margin-top:6px;overflow-x:auto"><table class="iv-neon-tbl"><thead><tr><th>Subject</th><th>Role</th><th>Relation</th><th>Forced</th><th>Share</th></tr></thead><tbody>'
      + data.partnerList.map(function(p){return '<tr><td>'+esc(p.name)+'</td><td>'+esc(p.identity)+'</td><td>'+esc(p.relationship)+'</td><td>'+esc(p.forced)+'</td><td>'+esc(p.percentage)+'</td></tr>';}).join('')
      + '</tbody></table></div></div>');
  }
  parts.push('</div>');

  // 生育
  if (hasPositiveCount(data.pregnancy) || hasPositiveCount(data.impregnate)) {
    parts.push('<div class="iv-data-panel"><h3>REPRODUCTION</h3><div class="iv-data-grid">');
    if (hasPositiveCount(data.pregnancy)) {
      parts.push('<div class="iv-data-item" style="grid-column:1/-1"><div class="lbl">Pregnancy</div><div class="val">'+bn(esc(data.pregnancy)).replace(/\n/g,'<br>')+'</div></div>');
      if (data.pregnancyDetails) parts.push('<div class="iv-data-item" style="grid-column:1/-1"><div class="lbl">Pregnancy_Detail</div><div class="val">'+bn(esc(data.pregnancyDetails)).replace(/\n/g,'<br>')+'</div></div>');
    }
    if (hasPositiveCount(data.impregnate)) {
      parts.push('<div class="iv-data-item"><div class="lbl">Impregnated_Others</div><div class="val">'+bn(esc(data.impregnate)).replace(/\n/g,'<br>')+'</div></div>');
      if (data.impregnateDetails) parts.push('<div class="iv-data-item" style="grid-column:1/-1"><div class="lbl">Impregnate_Detail</div><div class="val">'+bn(esc(data.impregnateDetails)).replace(/\n/g,'<br>')+'</div></div>');
    }
    parts.push('</div></div>');
  }

  // 开发状态
  const devF = ([
    ['MOUTH',data.devMouth],['HAND',data.devHand],['FOOT',data.devFoot],
    ['BREAST',data.devBreast],['PENIS',data.devPenis],['VAGINA',data.devVagina],['ANAL',data.devAnal]
  ] as [string,string][]).filter(([,v])=>v&&v!=='不适用');
  if (devF.length>0) {
    parts.push('<div class="iv-data-panel"><h3>DEVELOPMENT</h3>');
    for (const [lbl,txt] of devF) {
      parts.push('<div class="iv-neon-dev-row"><span class="iv-neon-dev-lbl">'+esc(lbl)+'</span><span class="iv-neon-dev-body">'+bn(esc(txt))+'</span></div>');
    }
    parts.push('</div>');
  }

  // 经历
  const expsF: [string,string][] = [['FIRST_EXP',data.firstExp],['LAST_EXP',data.lastExp],['BEST_EXP',data.bestExp]];
  const vExps = expsF.filter(([,v])=>v&&v!=='无'&&v!=='暂无数据');
  if (vExps.length>0||(data.mastFirst&&data.mastFirst!=='无')||(data.mastWay&&data.mastWay!=='无')||data.mastCount||data.mastFreq) {
    parts.push('<div class="iv-data-panel"><h3>EXPERIENCE_LOG</h3><div class="iv-neon-exp">');
    for (const [lbl,txt] of vExps) {
      parts.push('<div class="iv-neon-exp-item"><h6>'+lbl+'</h6><p>'+esc(txt)+'</p></div>');
    }
    if (data.mastFirst&&data.mastFirst!=='无') parts.push('<div class="iv-neon-exp-item"><h6>SELF_PLEASURE</h6><p>'+esc(data.mastFirst)+'</p></div>');
    if (data.mastWay&&data.mastWay!=='无') parts.push('<div class="iv-neon-exp-item"><h6>METHOD</h6><p>'+esc(data.mastWay)+'</p></div>');
    parts.push('</div>');
    if (data.mastCount||data.mastFreq) {
      parts.push('<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(192,96,128,0.1);display:flex;gap:20px;flex-wrap:wrap;font-size:11px">');
      if (data.mastCount) parts.push('<span><span style="color:#806090;font-size:8px;letter-spacing:2px">SELF_COUNT</span> <span style="color:#c06080;font-weight:700">'+esc(data.mastCount)+'</span></span>');
      if (data.mastFreq) parts.push('<span><span style="color:#806090;font-size:8px;letter-spacing:2px">SELF_FREQ</span> <span style="color:#c06080;font-weight:700">'+esc(data.mastFreq)+'</span></span>');
      parts.push('</div>');
    }
    parts.push('</div>');
  }

  // 综合评估
  parts.push('<div class="iv-data-panel"><h3>ASSESSMENT</h3>');
  if (data.charmTypes.length>0) parts.push('<div style="margin-bottom:8px"><span style="font-size:8px;color:#806090;letter-spacing:2px">CHARM</span><div class="iv-neon-tags" style="margin-top:3px">'+data.charmTypes.map(t=>'<span class="iv-neon-tag alt">#'+esc(t)+'</span>').join('')+'</div></div>');
  if (data.pornTags.length>0) parts.push('<div style="margin-bottom:8px"><span style="font-size:8px;color:#806090;letter-spacing:2px">TAGS</span><div class="iv-neon-tags" style="margin-top:3px">'+data.pornTags.map(t=>'<span class="iv-neon-tag">#'+esc(t)+'</span>').join('')+'</div></div>');
  if (data.bestPart) parts.push('<div class="iv-neon-val" style="font-size:11px;margin-bottom:4px"><span style="color:#806090">BEST_PART</span> '+esc(data.bestPart)+'</div>');
  if (data.voice) parts.push('<div class="iv-neon-val" style="font-size:11px;margin-bottom:8px"><span style="color:#806090">VOICE</span><div style="margin-top:2px;line-height:1.7">'+esc(data.voice).replace(/\n/g,'<br>')+'</div></div>');
  if (data.rankAdvantages) parts.push('<div class="iv-neon-adv" style="font-size:10px;margin-bottom:4px">[+] '+esc(data.rankAdvantages)+'</div>');
  if (data.rankDisadvantages) parts.push('<div class="iv-neon-disadv" style="font-size:10px;margin-bottom:8px">[-] '+esc(data.rankDisadvantages)+'</div>');
  if (data.reviews) {
    parts.push('<div style="margin-top:8px"><span style="font-size:8px;color:#806090;letter-spacing:2px">RUMORS</span>');
    const rvs = data.reviews.split(/[-\n]/).map(l=>l.trim()).filter(Boolean);
    for (const r of rvs) {
      const ci = r.search(/[：:]/);
      if (ci>0) parts.push('<div class="iv-neon-rev"><strong>'+esc(r.substring(0,ci).trim())+'</strong>: '+esc(r.substring(ci+1).trim())+'</div>');
      else parts.push('<div class="iv-neon-rev">'+esc(r)+'</div>');
    }
    parts.push('</div>');
  }
  if (data.protagonistNote) parts.push('<div class="iv-note-prot">> ' + esc(data.protagonistNote) + '</div>');
  if (data.characterSelfNote) parts.push('<div class="iv-note-self">>> SELF_VIEW // ' + esc(data.characterSelfNote) + '</div>');
  parts.push('</div>');

  return ivStyleOnce(css) +
    '<div class="iv-popup"><div class="iv-popup-body"><div class="iv-wrap">' +
    parts.join('') +
    '</div></div></div>';
}

// ===================================================================
// 📋 萦绕 — 机密情报档案 (Classified Intel)
// ===================================================================
export function renderMinimalDossier(data: InvestigationData, charName: string): string {
  const css = `
.iv-wrap{font-family:"Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun","Helvetica Neue",Helvetica,"PingFang SC","Hiragino Sans GB",serif;background:var(--bg-color,#f8f6f0);color:var(--text-color,#1a1a1a);line-height:1.65;font-size:12.5px;position:relative;overflow:hidden}
/* 扫描噪点纸纹 */
.iv-wrap::before{content:"";position:absolute;top:0;left:0;right:0;bottom:0;background-image:url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.03\'/%3E%3C/svg%3E");opacity:0.4;pointer-events:none;z-index:0}
.iv-popup-body{overflow-y:auto;overflow-x:hidden;padding:0}
/* 档案袋头 */
.iv-intel-header{background:var(--bg-color,#f8f6f0);border-bottom:4px solid #c41e3a;padding:16px 20px 12px;position:relative;z-index:1}
.iv-intel-header::before{content:"CLASSIFIED";position:absolute;top:10px;right:16px;font-size:9px;font-weight:700;letter-spacing:3px;color:#c41e3a;border:2px solid #c41e3a;padding:2px 8px;transform:rotate(-3deg)}
/* 条形码装饰 */
.iv-barcode{display:inline-flex;gap:1.5px;align-items:flex-end;height:20px;margin-left:8px;vertical-align:middle;opacity:0.5}
.iv-barcode span{display:inline-block;width:2px;height:100%;background:var(--text-color,#1a1a1a)}
.iv-intel-id{font-size:9px;color:var(--secondary-text,#888);letter-spacing:2px;margin-bottom:2px}
.iv-intel-name{font-size:22px;font-weight:700;color:var(--text-color,#1a1a1a);letter-spacing:2px}
.iv-intel-grade{display:inline-block;background:#c41e3a;color:#fff;padding:2px 14px;font-size:11px;font-weight:700;letter-spacing:4px;margin-top:4px}
.iv-intel-rank{font-size:10px;color:var(--secondary-text,#888);letter-spacing:2px;margin-top:4px}
.iv-intel-desc{font-size:11.5px;color:var(--secondary-text,#666);line-height:1.7;margin-top:8px;padding:10px 14px;background:rgba(0,0,0,0.03);border-left:3px solid var(--border-color,#ddd)}
/* 红条遮盖 — 敏感数据交互 */
.iv-redact-bar{display:inline-block;background:#1a1a1a;color:transparent;padding:0 4px;min-width:40px;cursor:pointer;transition:all 0.3s;position:relative;border-radius:2px;user-select:none}
.iv-redact-bar:hover{background:transparent;color:inherit}
.iv-redact-bar::after{content:"[REDACTED]";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#c41e3a;font-size:8px;letter-spacing:2px;font-weight:700;white-space:nowrap;pointer-events:none}
.iv-redact-bar:hover::after{display:none}
/* 分类印章动画 */
@keyframes iv-classify{0%{transform:rotate(-5deg) scale(3);opacity:0}60%{transform:rotate(2deg) scale(0.95)}100%{transform:rotate(-3deg) scale(1);opacity:1}}
.iv-classify-stamp{animation:iv-classify 0.5s cubic-bezier(0.34,1.56,0.64,1)}
/* 数据表 */
.iv-intel-section{margin:0;padding:14px 20px;border-bottom:1px solid var(--border-color,#e0e0e0);position:relative}
.iv-intel-section h3{font-size:9px;color:#c41e3a;letter-spacing:4px;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:8px}
.iv-intel-section h3::after{content:"";flex:1;height:1px;background:var(--border-color,#e0e0e0)}
/* 页码标记 */
.iv-page-num{position:absolute;top:10px;right:10px;font-size:7px;color:var(--secondary-text,#888);opacity:0.35;letter-spacing:1px;font-family:"Courier New",monospace}
/* 解密日期水印 */
.iv-declass-date{text-align:center;padding:16px 20px;font-size:8.5px;color:var(--secondary-text,#888);opacity:0.4;letter-spacing:2px;font-family:"Courier New",monospace;font-style:italic}
.iv-intel-row{display:flex;gap:8px;padding:4px 0;font-size:11.5px}
.iv-intel-row .lbl{color:var(--secondary-text,#888);min-width:90px;font-size:9px;text-transform:uppercase;letter-spacing:2px}
.iv-intel-row .val{color:var(--text-color,#1a1a1a);font-weight:500;flex:1}
.iv-intel-row .val .redact{color:#c41e3a}
/* 评分条 — 简洁 */
.iv-intel-bar-row{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.iv-intel-bar-lbl{color:var(--secondary-text,#888);font-size:9px;min-width:80px;text-align:right;text-transform:uppercase}
.iv-intel-bar{flex:1;height:4px;background:var(--border-color,#e0e0e0);border-radius:0}
.iv-intel-bar-fill{height:100%;background:#c41e3a;border-radius:0;transition:width 0.8s ease}
.iv-intel-bar-num{font-size:12px;font-weight:700;color:#c41e3a;min-width:35px;font-family:"Courier New",monospace}
.iv-intel-bar-desc{font-size:9.5px;color:var(--secondary-text,#888);margin-left:88px;margin-top:2px;font-style:italic}
/* 标签 — 归档标签 */
.iv-intel-tags{display:flex;flex-wrap:wrap;gap:4px}
.iv-intel-tag{display:inline-block;padding:1px 8px;font-size:9px;letter-spacing:1px;border:1px solid var(--border-color,#ccc);color:var(--secondary-text,#666);background:rgba(0,0,0,0.02);text-transform:uppercase}
/* 统计数字 */
.iv-intel-stats{display:flex;gap:1px;flex-wrap:wrap;margin-bottom:8px}
.iv-intel-stat{flex:1;min-width:80px;text-align:center;padding:12px 4px;background:rgba(0,0,0,0.02);border:1px solid var(--border-color,#e0e0e0)}
.iv-intel-stat .num{font-size:24px;font-weight:700;color:var(--text-color,#1a1a1a);font-family:"Courier New",monospace}
.iv-intel-stat .lbl{font-size:7.5px;color:var(--secondary-text,#888);letter-spacing:3px;text-transform:uppercase;margin-top:2px}
/* 表格 */
.iv-intel-tbl{width:100%;border-collapse:collapse;font-size:10.5px}
.iv-intel-tbl th{text-align:left;color:var(--secondary-text,#888);font-size:8px;text-transform:uppercase;letter-spacing:2px;padding:4px 8px;border-bottom:2px solid var(--border-color,#ccc)}
.iv-intel-tbl td{padding:3px 8px;border-bottom:1px solid var(--border-color,#eee);color:var(--text-color,#1a1a1a)}
/* 开发行 */
.iv-intel-dev-row{display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-color,#eee);align-items:flex-start}
.iv-intel-dev-lbl{font-size:9px;color:var(--text-color,#1a1a1a);font-weight:600;letter-spacing:2px;min-width:70px;text-transform:uppercase}
.iv-intel-dev-body{font-size:11px;color:var(--secondary-text,#666);line-height:1.65;flex:1}
/* 经历 — 打字机 */
.iv-intel-exp{border-left:2px solid var(--border-color,#ccc);margin-left:8px;padding-left:14px}
.iv-intel-exp-item{margin-bottom:10px}
.iv-intel-exp-item h6{font-size:9px;color:#c41e3a;letter-spacing:3px;text-transform:uppercase;margin-bottom:2px}
.iv-intel-exp-item p{font-size:11px;color:var(--secondary-text,#666);line-height:1.65}
/* 评价 */
.iv-intel-rev{padding:8px 10px;margin-bottom:4px;background:rgba(0,0,0,0.02);border-left:3px solid var(--border-color,#ccc);font-size:10.5px;color:var(--secondary-text,#666)}
.iv-intel-rev strong{color:var(--text-color,#1a1a1a)}
/* 主角评价 / 角色自评 */
.iv-note-prot,.iv-note-self{font-family:"Noto Sans SC","Noto Sans CJK SC","Source Han Sans SC","PingFang SC","Microsoft YaHei","Heiti SC","WenQuanYi Micro Hei","PingFang SC","Microsoft YaHei",sans-serif;font-size:13px;line-height:1.6;padding:8px 10px;margin-top:8px;color:#3a3a3a}
.iv-note-prot{border-left:3px solid #c41e3a;background:rgba(196,30,58,0.04)}
.iv-note-self{border-left:3px solid #8b6d30;background:rgba(139,109,48,0.05)}
/* 暗色 */
.dark .iv-wrap{background:#1a1a1a;color:#e0e0e0}
.dark .iv-age{filter:brightness(1.7)}
.dark .iv-intel-header{background:#1a1a1a}
.dark .iv-intel-name{color:#e0e0e0}
.dark .iv-intel-desc{background:rgba(255,255,255,0.03);border-left-color:#444}
.dark .iv-redact-bar{background:#e0e0e0}
.dark .iv-intel-section{border-bottom-color:#333}
.dark .iv-intel-section h3::after{background:#333}
.dark .iv-intel-bar{background:#333}
.dark .iv-intel-bar-desc{color:#999}
.dark .iv-intel-stat{background:rgba(255,255,255,0.02);border-color:#333}
.dark .iv-intel-stat .num{color:#e0e0e0}
.dark .iv-intel-tag{border-color:#444;color:#aaa;background:rgba(255,255,255,0.02)}
.dark .iv-intel-tbl th{border-bottom-color:#444}
.dark .iv-intel-tbl td{border-bottom-color:#333}
.dark .iv-intel-dev-row{border-bottom-color:#333}
.dark .iv-intel-exp{border-left-color:#444}
.dark .iv-intel-dev-body{color:#aaa}
.dark .iv-intel-exp-item p{color:#aaa}
.dark .iv-intel-row .lbl{color:#888}
.dark .iv-intel-row .val{color:#e0e0e0}
.dark .iv-barcode span{background:#e0e0e0}
.dark .iv-page-num{color:#888}
.dark .iv-declass-date{color:#888}
.dark .iv-intel-rev{color:#bbb}
.dark .iv-note-prot,.dark .iv-note-self{color:#d8d8d8}
.dark .iv-note-prot{background:rgba(196,30,58,0.12)}
.dark .iv-note-self{background:rgba(139,109,48,0.14)}
@media(max-width:600px){.iv-intel-stats{flex-direction:column}}
`;

  const parts: string[] = [];
  // 条形码 — 随机5-8条不等宽竖线
  var barcodeHtml = '<span class="iv-barcode">';
  var barCount = 5 + Math.floor(Math.random()*4);
  for (var bi=0;bi<barCount;bi++){var bw=1+Math.floor(Math.random()*3);barcodeHtml+='<span style="width:'+bw+'px;height:'+(12+Math.floor(Math.random()*8))+'px"></span>';}
  barcodeHtml += '</span>';
  parts.push('<div class="iv-intel-header">');
  parts.push('<div class="iv-intel-id">CASE FILE // '+esc(charName).toUpperCase().replace(/\s/g,'_')+'</div>');
  parts.push('<div class="iv-intel-name iv-classify-stamp">'+esc(data.name||charName)+'</div>');
  if (data.grade) parts.push('<div class="iv-intel-grade">'+esc(data.grade)+'</div>');
  if (data.globalRank) parts.push('<div class="iv-intel-rank">GLOBAL RANK: '+esc(data.globalRank)+' '+barcodeHtml+'</div>');
  if (data.description) parts.push('<div class="iv-intel-desc">'+esc(data.description)+'</div>');
  parts.push('</div>');

  // 基本档案
  parts.push('<div class="iv-intel-section"><span class="iv-page-num">PAGE 1 OF 8</span><h3>Basic Profile</h3>');
  if (data.sex) parts.push('<div class="iv-intel-row"><span class="lbl">Sex</span><span class="val">'+esc(data.sex)+'</span></div>');
  if (data.age) {
    const ac = ageColor(data.age,'#5a825a','#8b6d30','#c07830','#c41e3a');
    parts.push('<div class="iv-intel-row"><span class="lbl">Age</span><span class="val iv-age" style="color:'+ac+';font-weight:700">'+esc(data.age)+'</span></div>');
  }
  if (data.body) parts.push('<div class="iv-intel-row"><span class="lbl">Body</span><span class="val">'+bn(esc(data.body))+'</span></div>');
  parts.push('</div>');

  // 外貌风格
  if (data.dailyClothes||data.privateClothes||data.makeup) {
    parts.push('<div class="iv-intel-section"><h3>Style</h3>');
    for (const [lbl,val] of [['Daily',data.dailyClothes],['Private',data.privateClothes],['Makeup',data.makeup]] as const) {
      if (val) parts.push('<div class="iv-intel-row"><span class="lbl">'+lbl+'</span><span class="val">'+esc(val)+'</span></div>');
    }
    parts.push('</div>');
  }

  // 心理
  parts.push('<div class="iv-intel-section"><h3>Psychology</h3>');
  if (data.orientation) parts.push('<div class="iv-intel-row"><span class="lbl">Orientation</span><span class="val">'+esc(data.orientation)+'</span></div>');
  for (const [lbl,sv] of [['Shame',data.shameIndex],['Confidence',data.confidenceIndex],['Openness',data.opennessIndex]] as const) {
    if (sv) {
      parts.push('<div class="iv-intel-bar-row"><span class="iv-intel-bar-lbl">'+lbl+'</span><div class="iv-intel-bar"><div class="iv-intel-bar-fill" style="width:'+sv.score+'%"></div></div><span class="iv-intel-bar-num">'+sv.score+'</span></div>');
      if (sv.desc) parts.push('<div class="iv-intel-bar-desc">'+esc(sv.desc)+'</div>');
    }
  }
  if (data.coreFetishes.length>0) {
    parts.push('<div style="margin-top:6px"><span style="font-size:8px;color:#c41e3a;letter-spacing:2px;text-transform:uppercase">Fetishes</span><div class="iv-intel-tags" style="margin-top:3px">'+data.coreFetishes.map(t=>'<span class="iv-intel-tag">#'+esc(t)+'</span>').join('')+'</div></div>');
  }
  parts.push('</div>');

  // 红条遮盖 — 接收纯文本，内部统一转义 + 数字加粗 + 换行
  // (调用方不得预 esc 或预构 HTML，否则 <b>/<br> 会被二次转义成字面文本)
  const redact = (s: string) => '<span class="iv-redact-bar">'+bn(esc(s)).replace(/\n/g,'<br>')+'</span>';

  // 纯洁 — 红条遮盖
  parts.push('<div class="iv-intel-section"><h3>Purity [SENSITIVE]</h3>');
  const pm = data.purityScore.match(/(\d+)/);
  const pv2 = pm?parseInt(pm[1],10):0;
  const rc2 = pv2<=25?'#c41e3a':pv2<=50?'#d4783a':pv2<=75?'#8b6d30':'#5a825a';
  parts.push('<div style="display:flex;align-items:center;gap:16px;margin-bottom:8px">');
  parts.push('<div style="width:70px;height:70px;border-radius:50%;border:3px solid '+rc2+';display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:'+rc2+';font-family:Courier New,monospace">'+pv2+'%</div>');
  parts.push('<div style="flex:1">');
  if (data.isVirgin) parts.push('<div class="iv-intel-row"><span class="lbl">Status</span><span class="val">'+esc(data.isVirgin)+'</span></div>');
  if (data.defloration&&data.defloration!=='无') {
    const deflorParts = data.defloration.split(/[,，]/);
    const redactedDeflor = deflorParts.map((p,i) => i===1 ? redact(p.trim()) : esc(p.trim())).join(', ');
    parts.push('<div class="iv-intel-row"><span class="lbl">First</span><span class="val">'+redactedDeflor+'</span></div>');
  }
  if (data.purityDetails) parts.push('<div style="font-size:10.5px;color:var(--secondary-text,#666);margin-top:8px;padding-top:8px;border-top:1px solid var(--border-color,#eee);line-height:1.65">'+redact(data.purityDetails)+'</div>');
  parts.push('</div></div></div>');

  // 性爱统计 — 数字涂黑
  parts.push('<div class="iv-intel-section"><h3>Sexual Statistics</h3>');
  parts.push('<div class="iv-intel-stats">');
  // 男女分列随统计卡一同涂黑（本主题统计数字均为机密涂黑样式）
  var ivIntelRatio = objectGenderRatioText(data.partnerGenderRatio, data.partnerCount);
  if (data.sexCount) parts.push('<div class="iv-intel-stat"><div class="num">'+redact(extractLeadingNumber(data.sexCount)||data.sexCount)+'</div><div class="lbl">Total</div></div>');
  if (data.partnerCount || data.partnerGenderRatio) parts.push('<div class="iv-intel-stat"><div class="num">'+redact(objectCountNumber(data.partnerCount, data.partnerGenderRatio))+'</div><div class="lbl">Partners</div>'+(ivIntelRatio?'<div style="font-size:9.5px;opacity:0.72;margin-top:3px;letter-spacing:0.5px">'+redact(ivIntelRatio)+'</div>':'')+'</div>');
  if (data.frequency) parts.push('<div class="iv-intel-stat"><div style="font-size:14px;font-weight:700">'+esc(data.frequency)+'</div><div class="lbl">Frequency</div></div>');
  parts.push('</div>');
  // 极简短线条 — Swiss/Tufte 数据可视化风格
  var thinColors = ['#c04050','#5a5048','#3a5a3a','#a06030','#304050','#403860','#6a5040','#687888'];
  if (data.positionItems.length>0) parts.push('<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(0,0,0,0.04)"><span style="font-size:8px;color:#706860;letter-spacing:3px;text-transform:uppercase">Positions</span>'+renderThinBars(data.positionItems,thinColors)+'</div>');
  if (data.locationItems.length>0) parts.push('<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,0.04)"><span style="font-size:8px;color:#706860;letter-spacing:3px;text-transform:uppercase">Locations</span>'+renderThinBars(data.locationItems,thinColors)+'</div>');
  // 性伴名单
  if (data.partnerList.length>0) {
    parts.push('<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(0,0,0,0.04)"><span style="font-size:8px;color:#706860;letter-spacing:3px;text-transform:uppercase">Partner List [SENSITIVE]</span><div style="margin-top:6px;overflow-x:auto"><table class="iv-intel-tbl"><thead><tr><th>Name</th><th>Role</th><th>Relation</th><th>Forced</th><th>Share</th></tr></thead><tbody>'
      + data.partnerList.map(function(p){return '<tr><td>'+esc(p.name)+'</td><td>'+esc(p.identity)+'</td><td>'+esc(p.relationship)+'</td><td>'+esc(p.forced)+'</td><td>'+redact(p.percentage)+'</td></tr>';}).join('')
      + '</tbody></table></div></div>');
  }
  parts.push('</div>');

  // 生育记录
  if (hasPositiveCount(data.pregnancy) || hasPositiveCount(data.impregnate)) {
    parts.push('<div class="iv-intel-section"><h3>Reproductive Record [SENSITIVE]</h3>');
    if (hasPositiveCount(data.pregnancy)) {
      parts.push('<div class="iv-intel-row"><span class="lbl">Pregnancy</span><span class="val">'+redact(data.pregnancy)+'</span></div>');
      if (data.pregnancyDetails) parts.push('<div class="iv-intel-row"><span class="lbl">Detail</span><span class="val">'+bn(esc(data.pregnancyDetails)).replace(/\n/g,'<br>')+'</span></div>');
    }
    if (hasPositiveCount(data.impregnate)) {
      parts.push('<div class="iv-intel-row"><span class="lbl">Impregnated</span><span class="val">'+redact(data.impregnate)+'</span></div>');
      if (data.impregnateDetails) parts.push('<div class="iv-intel-row"><span class="lbl">Impregnate_Detail</span><span class="val">'+bn(esc(data.impregnateDetails)).replace(/\n/g,'<br>')+'</span></div>');
    }
    parts.push('</div>');
  }

  // 开发
  const devF2 = ([['Mouth',data.devMouth],['Hand',data.devHand],['Foot',data.devFoot],['Breast',data.devBreast],['Penis',data.devPenis],['Vagina',data.devVagina],['Anal',data.devAnal]] as [string,string][]).filter(([,v])=>v&&v!=='不适用');
  if (devF2.length>0) {
    parts.push('<div class="iv-intel-section"><h3>Development</h3>');
    for (const [lbl,txt] of devF2) {
      parts.push('<div class="iv-intel-dev-row"><span class="iv-intel-dev-lbl">'+lbl+'</span><span class="iv-intel-dev-body">'+bn(esc(txt))+'</span></div>');
    }
    parts.push('</div>');
  }

  // 经历
  const exps2: [string,string][] = [['First Experience',data.firstExp],['Last Experience',data.lastExp],['Best Experience',data.bestExp]];
  const ve2 = exps2.filter(([,v])=>v&&v!=='无'&&v!=='暂无数据');
  if (ve2.length>0||(data.mastFirst&&data.mastFirst!=='无')||(data.mastWay&&data.mastWay!=='无')||data.mastCount||data.mastFreq) {
    parts.push('<div class="iv-intel-section"><h3>Experience</h3><div class="iv-intel-exp">');
    for (const [lbl,txt] of ve2) parts.push('<div class="iv-intel-exp-item"><h6>'+lbl+'</h6><p>'+esc(txt)+'</p></div>');
    if (data.mastFirst&&data.mastFirst!=='无') parts.push('<div class="iv-intel-exp-item"><h6>First Masturbation</h6><p>'+esc(data.mastFirst)+'</p></div>');
    if (data.mastWay&&data.mastWay!=='无') parts.push('<div class="iv-intel-exp-item"><h6>Method</h6><p>'+esc(data.mastWay)+'</p></div>');
    parts.push('</div>');
    if (data.mastCount||data.mastFreq) {
      parts.push('<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border-color,#eee);display:flex;gap:20px;flex-wrap:wrap;font-size:11px">');
      if (data.mastCount) parts.push('<div class="iv-intel-row" style="padding:2px 0"><span class="lbl">Self Count</span><span class="val">'+redact(data.mastCount)+'</span></div>');
      if (data.mastFreq) parts.push('<div class="iv-intel-row" style="padding:2px 0"><span class="lbl">Self Freq</span><span class="val">'+esc(data.mastFreq)+'</span></div>');
      parts.push('</div>');
    }
    parts.push('</div>');
  }

  // 评估
  parts.push('<div class="iv-intel-section"><h3>Assessment</h3>');
  if (data.charmTypes.length>0) parts.push('<div style="margin-bottom:6px"><span style="font-size:8px;color:#c41e3a;letter-spacing:2px;text-transform:uppercase">Charm</span><div class="iv-intel-tags" style="margin-top:3px">'+data.charmTypes.map(t=>'<span class="iv-intel-tag" style="border-color:#c41e3a;color:#c41e3a">'+esc(t)+'</span>').join('')+'</div></div>');
  if (data.pornTags.length>0) parts.push('<div style="margin-bottom:6px"><span style="font-size:8px;color:#c41e3a;letter-spacing:2px;text-transform:uppercase">Tags</span><div class="iv-intel-tags" style="margin-top:3px">'+data.pornTags.map(t=>'<span class="iv-intel-tag">'+esc(t)+'</span>').join('')+'</div></div>');
  if (data.bestPart) parts.push('<div class="iv-intel-row"><span class="lbl">Best Part</span><span class="val">'+esc(data.bestPart)+'</span></div>');
  if (data.voice) parts.push('<div class="iv-intel-row"><span class="lbl">Voice</span><span class="val">'+esc(data.voice).replace(/\n/g,'<br>')+'</span></div>');
  if (data.rankAdvantages) parts.push('<div style="font-size:10px;color:#5a825a;margin-bottom:2px">▲ '+esc(data.rankAdvantages)+'</div>');
  if (data.rankDisadvantages) parts.push('<div style="font-size:10px;color:#c41e3a">▼ '+esc(data.rankDisadvantages)+'</div>');
  if (data.reviews) {
    parts.push('<div style="margin-top:8px"><span style="font-size:8px;color:#c41e3a;letter-spacing:2px;text-transform:uppercase">Rumors</span>');
    const rvs = data.reviews.split(/[-\n]/).map(l=>l.trim()).filter(Boolean);
    for (const r of rvs) {
      const ci = r.search(/[：:]/);
      if (ci>0) parts.push('<div class="iv-intel-rev"><strong>'+esc(r.substring(0,ci).trim())+'</strong>: '+esc(r.substring(ci+1).trim())+'</div>');
      else parts.push('<div class="iv-intel-rev">'+esc(r)+'</div>');
    }
    parts.push('</div>');
  }
  if (data.protagonistNote) parts.push('<div class="iv-note-prot">[NOTE] ' + esc(data.protagonistNote) + '</div>');
  if (data.characterSelfNote) parts.push('<div class="iv-note-self">[SELF] ' + esc(data.characterSelfNote) + '</div>');
  parts.push('<span class="iv-page-num">PAGE 8 OF 8</span>');
  parts.push('</div>');
  // 解密日期水印
  var declassYear = new Date().getFullYear() + 50;
  parts.push('<div class="iv-declass-date">SCHEDULED DECLASSIFICATION: ' + declassYear + '-01-01 // ARCHIVE ID: ' + Math.random().toString(36).slice(2,8).toUpperCase() + '</div>');

  return ivStyleOnce(css) +
    '<div class="iv-popup"><div class="iv-popup-body"><div class="iv-wrap">' +
    parts.join('') +
    '</div></div></div>';
}

// ===================================================================
// 💕 甜恋 — 秘密情书 (Secret Love Letter)
// ===================================================================
export function renderSweetDossier(data: InvestigationData, charName: string): string {
  const css = `
.iv-wrap{font-family:"Noto Sans SC","Noto Sans CJK SC","Source Han Sans SC","PingFang SC","Microsoft YaHei","Heiti SC","WenQuanYi Micro Hei","Noto Serif SC","Noto Serif CJK SC","Source Han Serif SC","Songti SC","STSong","SimSun","NSimSun",sans-serif;background:linear-gradient(180deg,#fff5f7 0%,#ffe8f0 30%,#fff0f4 60%,#ffe8f0 100%);color:#6b3a4a;line-height:1.8;font-size:13px;position:relative;overflow:hidden}
.iv-wrap::before{content:"";position:absolute;top:0;left:0;right:0;bottom:0;background:url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 5 Q35 15 30 25 Q25 15 30 5' fill='%23ffb8c8' opacity='0.08'/%3E%3C/svg%3E");pointer-events:none;z-index:0}
/* 花边边框 */
.iv-love-wrapper{position:relative;z-index:1;padding:24px 28px;max-width:720px;margin:0 auto}
.iv-love-wrapper::before{content:"";position:absolute;top:12px;left:12px;right:12px;bottom:12px;border:2px solid #ffd0dc;pointer-events:none;z-index:-1}
/* 展开动画 */
@keyframes iv-love-unfold{0%{transform:scaleY(0);opacity:0;transform-origin:top}100%{transform:scaleY(1);opacity:1;transform-origin:top}}
.iv-love-header{text-align:center;padding:8px 0 20px;position:relative;animation:iv-love-unfold 0.6s ease}
.iv-love-header::after{content:"❤";position:absolute;bottom:0;left:50%;transform:translateX(-50%);font-size:14px;color:#ff8fab;opacity:0.5}
.iv-love-date{font-family:"Dancing Script","Snell Roundhand","Apple Chancery","Segoe Script","Comic Sans MS",cursive;font-size:16px;color:#d08090;margin-bottom:4px;letter-spacing:1px}
.iv-love-name{font-size:30px;font-weight:700;color:#c04060;font-family:"Georgia",serif;letter-spacing:3px;margin-bottom:4px}
.iv-love-grade{display:inline-block;background:linear-gradient(135deg,#ff8fab,#ff6b8a);color:#fff;padding:4px 20px;border-radius:20px;font-size:13px;font-weight:600;letter-spacing:3px;box-shadow:0 3px 12px rgba(255,107,138,0.3);animation:iv-heartbeat 1.5s ease-in-out infinite}
@keyframes iv-heartbeat{0%,100%{transform:scale(1)}15%{transform:scale(1.08)}30%{transform:scale(1)}45%{transform:scale(1.05)}60%{transform:scale(1)}}
.iv-love-rank{font-size:11px;color:#c08090;letter-spacing:2px;margin-top:6px}
.iv-love-desc{font-size:12.5px;color:#8b5a6a;line-height:1.85;text-align:center;max-width:560px;margin:12px auto 0;font-style:italic;padding:10px 16px;background:rgba(255,143,171,0.06);border-radius:12px}
/* 章节 — 蕾丝卡片 */
.iv-love-section{margin-bottom:14px;padding:16px 18px;background:rgba(255,255,255,0.5);border-radius:12px;border:1px solid #ffd0dc;position:relative;overflow:hidden}
/* 手写倾斜 — 奇偶段落微旋 */
.iv-love-section:nth-child(odd){transform:rotate(0.2deg)}
.iv-love-section:nth-child(even){transform:rotate(-0.15deg)}
.iv-love-section::before{content:"";position:absolute;top:0;left:0;width:40px;height:40px;border-top:2px solid #ff8fab;border-left:2px solid #ff8fab;border-radius:12px 0 0 0;opacity:0.3}
.iv-love-section h3{font-family:"Dancing Script","Snell Roundhand","Apple Chancery","Segoe Script","Comic Sans MS",cursive;font-size:18px;color:#d06080;letter-spacing:2px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px dotted #ffd0dc}
/* 干花装饰 — 压花花瓣 */
.iv-petal{position:absolute;pointer-events:none;opacity:0.15;z-index:0}
.iv-petal-1{top:18px;right:20px;transform:rotate(25deg)}
.iv-petal-2{bottom:30px;left:16px;transform:rotate(-40deg)}
.iv-petal-3{top:40%;right:14px;transform:rotate(70deg)}
/* 书签缎带 */
.iv-bookmark-ribbon{position:absolute;right:-4px;top:-8px;width:4px;height:48px;background:linear-gradient(180deg,#ff8fab,#ff6b8a,#ff8fab);z-index:5;border-radius:2px;box-shadow:0 1px 4px rgba(255,107,138,0.3)}
.iv-bookmark-ribbon::after{content:"";position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #ff6b8a}
/* 数据行 */
.iv-love-row{display:flex;gap:8px;padding:3px 0;font-size:12.5px}
.iv-love-row .lbl{color:#c08090;min-width:80px;font-size:10px;letter-spacing:2px}
.iv-love-row .val{color:#6b3a4a;font-weight:500}
/* 心形进度条 */
.iv-heart-bar-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.iv-heart-bar-lbl{color:#c08090;font-size:10px;min-width:70px;text-align:right}
.iv-heart-bar{flex:1;height:8px;background:#ffd0dc;border-radius:4px;overflow:hidden;position:relative}
.iv-heart-bar-fill{height:100%;background:linear-gradient(90deg,#ff8fab,#ff6b8a);border-radius:4px;box-shadow:0 0 8px rgba(255,107,138,0.3);transition:width 1s ease;position:relative}
.iv-heart-bar-fill::after{content:"♥";position:absolute;right:-8px;top:-2px;font-size:10px;color:#ff6b8a}
.iv-heart-bar-num{font-size:13px;font-weight:700;color:#e8557a;min-width:35px}
.iv-heart-bar-desc{font-size:10px;color:#c08090;margin-left:78px;margin-top:2px;font-style:italic}
/* 标签 — 爱心标签 */
.iv-love-tags{display:flex;flex-wrap:wrap;gap:4px}
.iv-love-tag{display:inline-block;padding:3px 12px;font-size:10px;letter-spacing:1px;background:rgba(255,143,171,0.08);color:#c04060;border-radius:12px;border:1px solid rgba(255,143,171,0.3)}
.iv-love-tag.alt{background:rgba(240,160,184,0.08);color:#b06070;border-color:rgba(240,160,184,0.3)}
/* 统计卡 — 糖果卡片 */
.iv-love-stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.iv-love-stat{flex:1;min-width:80px;text-align:center;padding:14px 6px;background:linear-gradient(180deg,rgba(255,255,255,0.7),rgba(255,232,240,0.5));border-radius:12px;border:1px solid #ffd0dc}
.iv-love-stat .num{font-size:24px;font-weight:700;color:#e8557a;font-family:"Georgia",serif}
.iv-love-stat .num .small{font-size:14px}
.iv-love-stat .lbl{font-size:9px;color:#c08090;letter-spacing:2px;margin-top:2px}
/* 纯爱环 — 花瓣环 */
.iv-love-pure-ring{display:inline-flex;align-items:center;justify-content:center;width:80px;height:80px;border-radius:50%;font-size:20px;font-weight:700;position:relative;font-family:"Georgia",serif}
.iv-love-pure-ring::before{content:"✿";position:absolute;top:-12px;font-size:12px;opacity:0.6}
/* 经历 — 日记页 */
.iv-love-exp{border-left:2px solid #ffd0dc;margin-left:8px;padding-left:14px}
.iv-love-exp-item{margin-bottom:10px}
.iv-love-exp-item h6{font-size:10px;color:#e8557a;letter-spacing:2px;margin-bottom:2px}
.iv-love-exp-item p{font-size:12px;color:#8b5a6a;line-height:1.75}
/* 评价 */
.iv-love-rev{padding:8px 12px;margin-bottom:4px;background:rgba(255,232,240,0.4);border-radius:8px;font-size:11.5px;color:#8b5a6a;border-left:3px solid #ff8fab}
.iv-love-rev strong{color:#c04060}
/* 主角评价 / 角色自评 */
.iv-note-prot,.iv-note-self{font-family:"Noto Sans SC","Noto Sans CJK SC","Source Han Sans SC","PingFang SC","Microsoft YaHei","Heiti SC","WenQuanYi Micro Hei","PingFang SC","Microsoft YaHei",sans-serif;font-size:13px;line-height:1.6;padding:8px 14px;margin-top:8px;border-radius:8px}
.iv-note-prot{border-left:3px solid #ff8fab;background:rgba(255,143,171,0.06);color:#a0405a}
.iv-note-self{border-left:3px solid #ffb8c8;background:rgba(255,184,200,0.08);color:#90506a}
/* 暗色 — 深藏情书 */
.dark .iv-wrap{background:linear-gradient(180deg,#2a1020 0%,#1a0a15 30%,#200a18 60%,#1a0a15 100%);color:#d0a0b0}
.dark .iv-age{filter:brightness(1.7)}
.dark .iv-love-wrapper::before{border-color:rgba(255,143,171,0.15)}
.dark .iv-love-section{background:rgba(255,255,255,0.03);border-color:rgba(255,143,171,0.15)}
.dark .iv-love-section::before{border-color:rgba(255,143,171,0.3)}
.dark .iv-love-section h3{color:#e08090;border-bottom-color:rgba(255,143,171,0.2)}
.dark .iv-love-name{color:#e08090}
.dark .iv-love-date{color:#c08090}
.dark .iv-love-rank{color:#b08090}
.dark .iv-love-desc{color:#c090a0;background:rgba(255,143,171,0.04)}
.dark .iv-love-row .lbl{color:#b08090}
.dark .iv-love-row .val{color:#d0a0b0}
.dark .iv-heart-bar{background:rgba(255,143,171,0.15)}
.dark .iv-heart-bar-lbl{color:#b08090}
.dark .iv-heart-bar-desc{color:#b090a0}
.dark .iv-love-stat{background:rgba(255,255,255,0.02);border-color:rgba(255,143,171,0.15)}
.dark .iv-love-stat .num{color:#e08090}
.dark .iv-love-stat .lbl{color:#b08090}
.dark .iv-love-exp{border-left-color:rgba(255,143,171,0.2)}
.dark .iv-love-exp-item p{color:#c090a0}
.dark .iv-love-rev{background:rgba(255,143,171,0.04);color:#c090a0}
.dark .iv-love-rev strong{color:#e08090}
.dark .iv-note-prot{color:#f2c0d0;background:rgba(255,143,171,0.12)}
.dark .iv-note-self{color:#e6b8c8;background:rgba(255,184,200,0.10)}
.dark .iv-love-tag{background:rgba(255,143,171,0.06);color:#d08090}
@media(max-width:600px){.iv-love-wrapper{padding:16px 14px}}
`;

  const parts: string[] = [];
  // 干花装饰 — 压花花瓣SVG
  var petalSvg = '<svg width="28" height="32" viewBox="0 0 28 32" class="iv-petal iv-petal-1"><ellipse cx="14" cy="16" rx="5" ry="13" fill="#ffb8c8" transform="rotate(15 14 16)" opacity="0.6"/><ellipse cx="14" cy="16" rx="4" ry="11" fill="#ff8fab" transform="rotate(-10 14 16)" opacity="0.4"/></svg>';
  var leafSvg = '<svg width="22" height="26" viewBox="0 0 22 26" class="iv-petal iv-petal-2"><ellipse cx="11" cy="13" rx="4" ry="10" fill="#90c0a0" transform="rotate(-20 11 13)" opacity="0.5"/><line x1="11" y1="3" x2="11" y2="23" stroke="#80b090" stroke-width="0.5" opacity="0.4"/></svg>';
  var smallPetal = '<svg width="18" height="22" viewBox="0 0 18 22" class="iv-petal iv-petal-3"><ellipse cx="9" cy="11" rx="3" ry="8" fill="#ffd0dc" transform="rotate(30 9 11)" opacity="0.5"/></svg>';
  parts.push('<div class="iv-love-wrapper">');
  parts.push('<div class="iv-bookmark-ribbon"></div>');
  parts.push(petalSvg + leafSvg + smallPetal);
  // 信头
  parts.push('<div class="iv-love-header">');
  parts.push('<div class="iv-love-date">✿ Secret Diary ✿</div>');
  parts.push('<div class="iv-love-name">'+esc(data.name||charName)+'</div>');
  if (data.grade) parts.push('<div class="iv-love-grade">♥ '+esc(data.grade)+' ♥</div>');
  if (data.globalRank) parts.push('<div class="iv-love-rank">✨ 排名 #'+esc(extractLeadingNumber(data.globalRank))+'</div>');
  if (data.description) parts.push('<div class="iv-love-desc">'+esc(data.description)+'</div>');
  parts.push('</div>');

  // 基本
  parts.push('<div class="iv-love-section"><h3>About Me</h3>');
  if (data.sex||data.age) {
    parts.push('<div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:4px">');
    if (data.sex) parts.push('<span><span class="lbl" style="color:#c08090;font-size:10px">性别</span> <span style="color:#6b3a4a;font-weight:500">'+esc(data.sex)+'</span></span>');
    if (data.age) {
      const ac = ageColor(data.age,'#5a825a','#e8557a','#e8557a','#c04060');
      parts.push('<span><span class="lbl" style="color:#c08090;font-size:10px">年龄</span> <span class="iv-age" style="color:'+ac+';font-weight:700">'+esc(data.age)+'</span></span>');
    }
    parts.push('</div>');
  }
  if (data.body) parts.push('<div style="font-size:12px;color:#8b5a6a">'+bn(esc(data.body))+'</div>');
  parts.push('</div>');

  // 外貌
  if (data.dailyClothes||data.privateClothes||data.makeup) {
    parts.push('<div class="iv-love-section"><h3>My Style</h3>');
    for (const [lbl,val] of [['日常穿搭',data.dailyClothes],['秘密衣橱',data.privateClothes],['妆容小心机',data.makeup]] as const) {
      if (val) parts.push('<div class="iv-love-row"><span class="lbl">'+lbl+'</span><span class="val">'+esc(val)+'</span></div>');
    }
    parts.push('</div>');
  }

  // 心理 — 心形进度条
  parts.push('<div class="iv-love-section"><h3>Secret Heart</h3>');
  if (data.orientation) parts.push('<div style="font-size:12px;margin-bottom:8px;color:#8b5a6a"><span style="color:#c08090">取向</span> '+esc(data.orientation)+'</div>');
  for (const [lbl,sv] of [['羞耻度',data.shameIndex],['自信度',data.confidenceIndex],['开放度',data.opennessIndex]] as const) {
    if (sv) {
      parts.push('<div class="iv-heart-bar-row"><span class="iv-heart-bar-lbl">'+lbl+'</span><div class="iv-heart-bar"><div class="iv-heart-bar-fill" style="width:'+sv.score+'%"></div></div><span class="iv-heart-bar-num">'+sv.score+'</span></div>');
      if (sv.desc) parts.push('<div class="iv-heart-bar-desc">'+esc(sv.desc)+'</div>');
    }
  }
  if (data.coreFetishes.length>0) {
    parts.push('<div style="margin-top:6px"><span style="font-size:9px;color:#d06080;letter-spacing:2px;font-family:"Dancing Script","Snell Roundhand","Apple Chancery","Segoe Script","Comic Sans MS",cursive">Secret Fetishes</span><div class="iv-love-tags" style="margin-top:3px">'+data.coreFetishes.map(t=>'<span class="iv-love-tag">♥ '+esc(t)+'</span>').join('')+'</div></div>');
  }
  parts.push('</div>');

  // 纯洁 — 花瓣环
  parts.push('<div class="iv-love-section"><h3>Purity Blossom</h3>');
  const pm3 = data.purityScore.match(/(\d+)/);
  const pv3 = pm3?parseInt(pm3[1],10):0;
  const rc3 = pv3<=25?'#c04060':pv3<=50?'#e8557a':pv3<=75?'#ff8fab':'#ffb8c8';
  parts.push('<div style="display:flex;align-items:center;gap:16px"><div class="iv-love-pure-ring" style="border:3px solid '+rc3+';color:'+rc3+'">'+pv3+'%</div><div style="flex:1">');
  if (data.isVirgin) parts.push('<div style="font-size:12px;color:#8b5a6a"><span style="color:#c08090">状态</span> '+esc(data.isVirgin)+'</div>');
  if (data.defloration&&data.defloration!=='无') parts.push('<div style="font-size:12px;color:#8b5a6a;margin-top:4px">'+esc(data.defloration)+'</div>');
  if (data.purityDetails) parts.push('<div style="font-size:11.5px;color:#8b5a6a;margin-top:8px;padding-top:8px;border-top:1px dotted #ffd0dc;line-height:1.8">'+bn(esc(data.purityDetails)).replace(/\n/g,'<br>')+'</div>');
  parts.push('</div></div></div>');

  // 性爱统计
  parts.push('<div class="iv-love-section"><h3>Love Stats</h3>');
  parts.push('<div class="iv-love-stats">');
  if (data.sexCount) parts.push('<div class="iv-love-stat"><div class="num">'+esc(extractLeadingNumber(data.sexCount)||data.sexCount)+'</div><div class="lbl">甜蜜时刻</div></div>');
  if (data.partnerCount || data.partnerGenderRatio) parts.push('<div class="iv-love-stat"><div class="num">'+esc(objectCountNumber(data.partnerCount, data.partnerGenderRatio))+'</div><div class="lbl">特别的人</div>'+objectGenderSubLine(data.partnerGenderRatio, data.partnerCount)+'</div>');
  if (data.frequency) parts.push('<div class="iv-love-stat"><div style="font-size:15px;font-weight:700;color:#e8557a">'+esc(data.frequency)+'</div><div class="lbl">频率</div></div>');
  parts.push('</div>');
  // 糖果夹心比例条 — 横向堆叠条 + 爱心图例，与上方统计卡清晰分隔
  var candyColors = ['#e8557a','#f4989c','#ff8fab','#d06080','#fb6f92','#ffb3c6','#f08090','#e87090'];
  if (data.positionItems.length>0) parts.push('<div style="margin-top:18px;padding-top:14px;border-top:2px dotted #ffd0dc"><div style="font-family:\'Dancing Script\',cursive;font-size:15px;color:#e8557a;margin-bottom:10px;letter-spacing:3px">♥ 常用体位</div>'+renderStackedBar(data.positionItems,candyColors,20)+'</div>');
  if (data.locationItems.length>0) parts.push('<div style="margin-top:16px;padding-top:14px;border-top:2px dotted #ffd0dc"><div style="font-family:\'Dancing Script\',cursive;font-size:15px;color:#e8557a;margin-bottom:10px;letter-spacing:3px">♥ 场所分布</div>'+renderStackedBar(data.locationItems,candyColors,20)+'</div>');
  // 特别的人名单
  if (data.partnerList.length>0) {
    parts.push('<div style="margin-top:16px;padding-top:14px;border-top:2px dotted #ffd0dc"><div style="font-family:\'Dancing Script\',cursive;font-size:15px;color:#e8557a;margin-bottom:8px;letter-spacing:3px">♥ 那些特别的人</div>');
    for (const p of data.partnerList) {
      parts.push('<div style="padding:5px 0;border-bottom:1px dotted #ffd0dc;font-size:12px"><span style="color:#c04060;font-weight:600">'+esc(p.name)+'</span> <span style="color:#c08090;font-size:10px">· '+esc(p.identity)+' · '+esc(p.relationship)+(p.forced&&p.forced!=='无'?' · '+esc(p.forced):'')+(p.percentage?' · '+esc(p.percentage):'')+'</span></div>');
    }
    parts.push('</div>');
  }
  parts.push('</div>');

  // 孕育记事
  if (hasPositiveCount(data.pregnancy) || hasPositiveCount(data.impregnate)) {
    parts.push('<div class="iv-love-section"><h3>Baby Diary 🌸</h3>');
    if (hasPositiveCount(data.pregnancy)) {
      parts.push('<div class="iv-love-row"><span class="lbl">孕育</span><span class="val">'+bn(esc(data.pregnancy)).replace(/\n/g,'<br>')+'</span></div>');
      if (data.pregnancyDetails) parts.push('<div class="iv-love-row"><span class="lbl">孕育明细</span><span class="val">'+bn(esc(data.pregnancyDetails)).replace(/\n/g,'<br>')+'</span></div>');
    }
    if (hasPositiveCount(data.impregnate)) {
      parts.push('<div class="iv-love-row"><span class="lbl">使人怀孕</span><span class="val">'+bn(esc(data.impregnate)).replace(/\n/g,'<br>')+'</span></div>');
      if (data.impregnateDetails) parts.push('<div class="iv-love-row"><span class="lbl">相关明细</span><span class="val">'+bn(esc(data.impregnateDetails)).replace(/\n/g,'<br>')+'</span></div>');
    }
    parts.push('</div>');
  }

  // 开发
  const devF3 = ([['口部',data.devMouth],['手部',data.devHand],['足部',data.devFoot],['胸部',data.devBreast],['阳具',data.devPenis],['阴部',data.devVagina],['肛部',data.devAnal]] as [string,string][]).filter(([,v])=>v&&v!=='不适用');
  if (devF3.length>0) {
    parts.push('<div class="iv-love-section"><h3>Body Diary</h3>');
    for (const [lbl,txt] of devF3) {
      parts.push('<div style="padding:6px 0;border-bottom:1px dotted #ffd0dc;display:flex;gap:8px;align-items:flex-start;font-size:12px"><span style="color:#e8557a;font-weight:600;min-width:50px;font-size:10px;letter-spacing:2px">'+lbl+'</span><span style="color:#8b5a6a;flex:1">'+bn(esc(txt))+'</span></div>');
    }
    parts.push('</div>');
  }

  // 经历
  const exps3: [string,string][] = [['初次心动',data.firstExp],['最近甜蜜',data.lastExp],['最棒回忆',data.bestExp]];
  const ve3 = exps3.filter(([,v])=>v&&v!=='无'&&v!=='暂无数据');
  if (ve3.length>0||(data.mastFirst&&data.mastFirst!=='无')||(data.mastWay&&data.mastWay!=='无')||data.mastCount||data.mastFreq) {
    parts.push('<div class="iv-love-section"><h3>Love Memories</h3><div class="iv-love-exp">');
    for (const [lbl,txt] of ve3) parts.push('<div class="iv-love-exp-item"><h6>'+lbl+'</h6><p>'+esc(txt)+'</p></div>');
    if (data.mastFirst&&data.mastFirst!=='无') parts.push('<div class="iv-love-exp-item"><h6>秘密独处</h6><p>'+esc(data.mastFirst)+'</p></div>');
    if (data.mastWay&&data.mastWay!=='无') parts.push('<div class="iv-love-exp-item"><h6>私密方式</h6><p>'+esc(data.mastWay)+'</p></div>');
    parts.push('</div>');
    if (data.mastCount||data.mastFreq) {
      parts.push('<div style="margin-top:10px;padding-top:8px;border-top:1px dotted #ffd0dc;display:flex;gap:20px;flex-wrap:wrap;font-size:12px">');
      if (data.mastCount) parts.push('<span><span style="color:#c08090;font-size:10px;letter-spacing:2px">独处次数</span> <span style="color:#e8557a;font-weight:700">'+esc(data.mastCount)+'</span></span>');
      if (data.mastFreq) parts.push('<span><span style="color:#c08090;font-size:10px;letter-spacing:2px">独处频率</span> <span style="color:#e8557a;font-weight:700">'+esc(data.mastFreq)+'</span></span>');
      parts.push('</div>');
    }
    parts.push('</div>');
  }

  // 评估
  parts.push('<div class="iv-love-section"><h3>Love Letter</h3>');
  if (data.charmTypes.length>0) parts.push('<div style="margin-bottom:6px"><span style="font-size:9px;color:#d06080;letter-spacing:2px;font-family:"Dancing Script","Snell Roundhand","Apple Chancery","Segoe Script","Comic Sans MS",cursive">Charm</span><div class="iv-love-tags" style="margin-top:3px">'+data.charmTypes.map(t=>'<span class="iv-love-tag alt">✿ '+esc(t)+'</span>').join('')+'</div></div>');
  if (data.pornTags.length>0) parts.push('<div style="margin-bottom:6px"><span style="font-size:9px;color:#d06080;letter-spacing:2px;font-family:"Dancing Script","Snell Roundhand","Apple Chancery","Segoe Script","Comic Sans MS",cursive">Love Tags</span><div class="iv-love-tags" style="margin-top:3px">'+data.pornTags.map(t=>'<span class="iv-love-tag">♥ '+esc(t)+'</span>').join('')+'</div></div>');
  if (data.bestPart) parts.push('<div class="iv-love-row"><span class="lbl">最迷人之处</span><span class="val">'+esc(data.bestPart)+'</span></div>');
  if (data.voice) parts.push('<div class="iv-love-row"><span class="lbl">声音</span><span class="val">'+esc(data.voice).replace(/\n/g,'<br>')+'</span></div>');
  if (data.rankAdvantages) parts.push('<div style="font-size:11px;color:#e8557a;margin-bottom:2px">✦ '+esc(data.rankAdvantages)+'</div>');
  if (data.rankDisadvantages) parts.push('<div style="font-size:11px;color:#c08090">✧ '+esc(data.rankDisadvantages)+'</div>');
  if (data.reviews) {
    parts.push('<div style="margin-top:8px"><span style="font-size:9px;color:#d06080;letter-spacing:2px;font-family:"Dancing Script","Snell Roundhand","Apple Chancery","Segoe Script","Comic Sans MS",cursive">Whispers</span>');
    const rvs = data.reviews.split(/[-\n]/).map(l=>l.trim()).filter(Boolean);
    for (const r of rvs) {
      const ci = r.search(/[：:]/);
      if (ci>0) parts.push('<div class="iv-love-rev"><strong>'+esc(r.substring(0,ci).trim())+'</strong>：「'+esc(r.substring(ci+1).trim())+'」</div>');
      else parts.push('<div class="iv-love-rev">「'+esc(r)+'」</div>');
    }
    parts.push('</div>');
  }
  if (data.protagonistNote) parts.push('<div class="iv-note-prot">♥ ' + esc(data.protagonistNote) + '</div>');
  if (data.characterSelfNote) parts.push('<div class="iv-note-self">✿ ' + esc(data.characterSelfNote) + '</div>');
  parts.push('</div>');

  // 蜡封 — 放大并加立体阴影
  parts.push('<div style="text-align:center;padding:12px 0 6px"><svg width="52" height="52" viewBox="0 0 52 52" style="filter:drop-shadow(0 3px 6px rgba(192,64,96,0.35))"><defs><radialGradient id="waxGrad"><stop offset="0%" stop-color="#ff8fab"/><stop offset="60%" stop-color="#e8557a"/><stop offset="100%" stop-color="#b04060"/></radialGradient></defs><circle cx="26" cy="26" r="23" fill="url(#waxGrad)" opacity="0.9"/><circle cx="26" cy="26" r="21" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/><text x="26" y="31" text-anchor="middle" fill="#fff" font-size="16" font-weight="700">♥</text></svg></div>');

  parts.push('</div>'); // .iv-love-wrapper
  return ivStyleOnce(css) +
    '<div class="iv-popup"><div class="iv-popup-body"><div class="iv-wrap">' +
    parts.join('') +
    '</div></div></div>';
}

// ===================================================================
// ☁️ 云海 — 天机玉简 (Celestial Jade Tablet)
// ===================================================================
export function renderXianxiaDossier(data: InvestigationData, charName: string): string {
  const css = `
.iv-wrap{font-family:var(--ub-font-reading);background:linear-gradient(180deg,#e8f4f0 0%,#dcece4 40%,#d0e8e0 70%,#c8e0d8 100%);color:#2a4030;line-height:1.85;font-size:13px;position:relative;overflow:hidden}
/* 祥云纹背景 */
.iv-wrap::before{content:"";position:absolute;top:0;left:0;right:0;bottom:0;background:url("data:image/svg+xml,%3Csvg width='120' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 30 Q40 10 60 30 Q80 50 100 30' fill='none' stroke='%234a90a4' stroke-width='0.5' opacity='0.06'/%3E%3C/svg%3E");pointer-events:none;z-index:0}
/* 云雾缭绕边框 — 四角云纹 */
@keyframes iv-mist-drift{0%,100%{opacity:0.25;transform:translateX(0)}50%{opacity:0.4;transform:translateX(6px)}}
.iv-mist-corner{position:absolute;width:80px;height:60px;background:radial-gradient(ellipse at center,rgba(168,216,224,0.25),transparent 70%);pointer-events:none;z-index:0}
.iv-mist-corner.tl{top:-10px;left:-14px;animation:iv-mist-drift 8s ease-in-out infinite}
.iv-mist-corner.tr{top:-10px;right:-14px;animation:iv-mist-drift 8s ease-in-out 2s infinite reverse}
.iv-mist-corner.bl{bottom:-10px;left:-14px;animation:iv-mist-drift 8s ease-in-out 4s infinite}
.iv-mist-corner.br{bottom:-10px;right:-14px;animation:iv-mist-drift 8s ease-in-out 6s infinite reverse}
/* 浮动灵光粒子 */
@keyframes iv-float{0%{transform:translateY(0) translateX(0) scale(0);opacity:0}20%{transform:translateY(-20px) translateX(10px) scale(1);opacity:0.8}80%{transform:translateY(-80px) translateX(-10px) scale(0.8);opacity:0.4}100%{transform:translateY(-120px) translateX(5px) scale(0);opacity:0}}
.iv-particle{position:absolute;width:4px;height:4px;border-radius:50%;background:#7eb8c9;pointer-events:none;animation:iv-float 6s ease-in-out infinite}
.iv-particle:nth-child(2n){animation-delay:2s;width:3px;height:3px;background:#a0d0c0}
.iv-particle:nth-child(3n){animation-delay:4s;width:5px;height:5px;background:#c0e8d0}
/* 星辰连线（星宿图） */
.iv-constellation{position:absolute;top:16px;right:60px;pointer-events:none;z-index:1;opacity:0.35}
@keyframes iv-star-twinkle{0%,100%{opacity:0.5}50%{opacity:1}}
.iv-constellation .star{position:absolute;width:3px;height:3px;border-radius:50%;background:#4a90a4;animation:iv-star-twinkle 3s ease-in-out infinite}
.iv-constellation .star:nth-child(2n){animation-delay:1s;animation-duration:2.5s}
.iv-constellation .star:nth-child(3n){animation-delay:2s;animation-duration:3.5s}
.iv-popup-body{overflow-y:auto;overflow-x:hidden;padding:0;position:relative}
/* 玉石顶轴 */
.iv-jade-rod{height:12px;background:linear-gradient(180deg,#8cc4b0 0%,#5a9880 30%,#7eb8a0 50%,#4a8070 70%,#6aa890 100%);border-radius:3px;margin:12px 28px 0;box-shadow:0 2px 8px rgba(42,96,112,0.15),inset 0 1px 0 rgba(255,255,255,0.3);position:relative;z-index:1}
.iv-jade-rod::before,.iv-jade-rod::after{content:"◆";position:absolute;top:50%;transform:translateY(-50%);color:#c0d8c0;font-size:8px;opacity:0.6}
.iv-jade-rod::before{left:12px}
.iv-jade-rod::after{right:12px}
/* 天机头 */
.iv-celestial-header{text-align:center;padding:16px 20px 20px;position:relative;z-index:1}
@keyframes iv-celestial-reveal{0%{opacity:0;transform:translateY(-30px)}100%{opacity:1;transform:translateY(0)}}
.iv-celestial-seal{display:inline-block;border:2px solid #4a90a4;padding:4px 18px;color:#2a6070;font-size:14px;font-weight:700;letter-spacing:8px;position:relative;animation:iv-celestial-reveal 0.8s ease}
.iv-celestial-seal::before{content:"◇";position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-size:10px;color:#4a90a4;background:#e8f4f0;padding:0 6px}
.iv-celestial-seal::after{content:"◇";position:absolute;bottom:-10px;left:50%;transform:translateX(-50%);font-size:10px;color:#4a90a4;background:#e8f4f0;padding:0 6px}
.iv-celestial-name{font-size:32px;font-weight:700;color:#1a4030;letter-spacing:8px;margin:10px 0 4px;text-shadow:0 2px 4px rgba(42,96,112,0.1)}
.iv-celestial-grade{display:inline-block;background:linear-gradient(135deg,#7eb8c9,#4a90a4);color:#e8f4f0;padding:3px 22px;font-size:13px;font-weight:700;letter-spacing:6px;box-shadow:0 0 12px rgba(74,144,164,0.3)}
.iv-celestial-rank{font-size:11px;color:#5a8070;letter-spacing:4px;margin-top:6px}
.iv-celestial-desc{font-size:12px;color:#3a6048;line-height:1.85;max-width:600px;margin:10px auto 0;text-align:center;font-style:italic;padding:12px 16px;border-top:1px solid #c8dcd4;border-bottom:1px solid #c8dcd4}
/* 玉简节 */
.iv-jade-section{margin:0 32px 12px;padding:16px 18px;background:rgba(255,255,255,0.3);border:1px solid #c0d8cc;position:relative;z-index:1}
.iv-jade-section::before{content:"";position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(135deg,transparent 40%,rgba(255,255,255,0.2) 50%,transparent 60%);pointer-events:none}
/* 玉简龟裂纹 — 仅奇数section出现 */
.iv-jade-section:nth-child(odd)::after{content:"";position:absolute;top:8px;right:14px;width:22px;height:16px;background:linear-gradient(30deg,transparent 45%,rgba(160,200,184,0.15) 45%,rgba(160,200,184,0.15) 47%,transparent 47%),linear-gradient(-20deg,transparent 50%,rgba(160,200,184,0.1) 50%,rgba(160,200,184,0.1) 52%,transparent 52%),linear-gradient(70deg,transparent 48%,rgba(160,200,184,0.12) 48%,rgba(160,200,184,0.12) 50%,transparent 50%);pointer-events:none}
.iv-jade-section h3{font-size:11px;color:#2a6070;letter-spacing:5px;border-bottom:1px solid #c0d8cc;padding-bottom:8px;margin-bottom:10px;display:flex;align-items:center;gap:6px}
.iv-jade-section h3 .ico{display:inline-block;width:18px;height:18px;text-align:center;line-height:18px;font-size:12px}
/* 星点评级 */
@keyframes iv-star-light{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}
.iv-star{display:inline-block;font-size:14px;animation:iv-star-light 2s ease-in-out infinite}
/* 数据行 */
.iv-jade-row{display:flex;gap:10px;padding:3px 0;font-size:12.5px}
.iv-jade-row .lbl{color:#5a8070;min-width:70px;font-size:10px;letter-spacing:3px}
.iv-jade-row .val{color:#2a4030;font-weight:500}
/* 通用 val/body 内联色类（替代模板内联 #2a4030/#3a6048，配 .dark 覆盖，根因 D） */
.iv-jade-val{color:#2a4030;font-weight:500}
.iv-jade-body{color:#3a6048}
/* 灵根进度条 */
.iv-spirit-bar-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.iv-spirit-bar-lbl{color:#5a8070;font-size:10px;min-width:70px;text-align:right;letter-spacing:2px}
.iv-spirit-bar{flex:1;height:5px;background:#c8dcd4;border-radius:0;overflow:hidden}
.iv-spirit-bar-fill{height:100%;background:linear-gradient(90deg,#7eb8c9,#4a90a4);border-radius:0;box-shadow:0 0 6px rgba(74,144,164,0.4);transition:width 1s ease;position:relative}
/* 灵力流动纹 */
.iv-spirit-bar-fill::after{content:"";position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.3) 40%,rgba(255,255,255,0.4) 50%,rgba(255,255,255,0.3) 60%,transparent 100%);background-size:200% 100%;animation:iv-spirit-flow 2.5s ease-in-out infinite}
@keyframes iv-spirit-flow{0%{background-position:200% 0}100%{background-position:-200% 0}}
.iv-spirit-bar-num{font-size:13px;font-weight:700;color:#2a6070;min-width:35px}
.iv-spirit-bar-desc{font-size:10px;color:#5a8070;margin-left:78px;margin-top:2px;font-style:italic}
/* 标签 — 灵篆 */
.iv-jade-tags{display:flex;flex-wrap:wrap;gap:4px}
.iv-jade-tag{display:inline-block;padding:2px 10px;font-size:10px;letter-spacing:2px;border:1px solid #a0c8b8;color:#2a6070;background:rgba(74,144,164,0.06)}
.iv-jade-tag.alt{color:#4a90a4;border-color:#7eb8c9;background:rgba(126,184,201,0.08)}
/* 统计卡 — 灵石 */
.iv-jade-stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.iv-jade-stat{flex:1;min-width:80px;text-align:center;padding:14px 6px;background:linear-gradient(180deg,rgba(255,255,255,0.4),rgba(220,236,228,0.3));border:1px solid #c0d8cc;position:relative}
.iv-jade-stat::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,#4a90a4,transparent);opacity:0.4}
.iv-jade-stat .num{font-size:26px;font-weight:700;color:#2a6070;font-family:"Georgia",serif}
.iv-jade-stat .lbl{font-size:8px;color:#5a8070;letter-spacing:3px;margin-top:2px}
/* 开发状态 */
.iv-jade-dev-row{display:flex;gap:8px;padding:6px 0;border-bottom:1px solid #c8dcd4;align-items:flex-start}
.iv-jade-dev-row:last-child{border-bottom:none}
.iv-jade-dev-lbl{font-size:10px;color:#2a6070;font-weight:600;letter-spacing:3px;min-width:70px}
.iv-jade-dev-body{font-size:12px;color:#3a6048;line-height:1.75;flex:1}
/* 经历 — 时光轴 */
.iv-jade-exp{border-left:2px solid #a0c8b8;margin-left:8px;padding-left:14px;position:relative}
.iv-jade-exp-item{margin-bottom:10px;position:relative}
.iv-jade-exp-item::before{content:"";position:absolute;left:-21px;top:5px;width:8px;height:8px;border-radius:50%;background:#4a90a4;border:2px solid #e8f4f0}
.iv-jade-exp-item h6{font-size:10px;color:#2a6070;letter-spacing:3px;margin-bottom:2px}
.iv-jade-exp-item p{font-size:12px;color:#3a6048;line-height:1.75}
/* 评价 */
.iv-jade-rev{padding:8px 12px;margin-bottom:4px;background:rgba(255,255,255,0.3);border-left:3px solid #7eb8c9;font-size:11.5px;color:#3a6048;font-style:italic}
.iv-jade-rev strong{color:#2a4030;font-style:normal}
/* 主角评价 / 角色自评 */
.iv-note-prot,.iv-note-self{font-family:"Noto Sans SC","Noto Sans CJK SC","Source Han Sans SC","PingFang SC","Microsoft YaHei","Heiti SC","WenQuanYi Micro Hei","PingFang SC","Microsoft YaHei",sans-serif;font-size:13px;line-height:1.6;padding:8px 12px;margin-top:8px;color:#2a4030}
.iv-note-prot{border-left:3px solid #c07830;background:rgba(192,120,48,0.06)}
.iv-note-self{border-left:3px solid #7eb8c9;background:rgba(126,184,201,0.07)}
/* 暗色 — 星辰夜空 */
.dark .iv-wrap{background:linear-gradient(180deg,#0a1a18 0%,#0d1e1c 40%,#0a1816 70%,#081412 100%);color:#c0d8d0}
.dark .iv-age{filter:brightness(1.7)}
.dark .iv-celestial-seal{border-color:#7eb8c9;color:#a0d0c0}
.dark .iv-celestial-seal::before,.dark .iv-celestial-seal::after{color:#7eb8c9;background:#0a1a18}
.dark .iv-celestial-name{color:#d8ece0;text-shadow:0 0 10px rgba(126,184,201,0.2)}
.dark .iv-celestial-rank{color:#8ab8a8}
.dark .iv-celestial-desc{color:#a0c8b8;border-color:rgba(126,184,201,0.2)}
.dark .iv-jade-section{background:rgba(255,255,255,0.03);border-color:rgba(126,184,201,0.15)}
.dark .iv-jade-section::before{background:linear-gradient(135deg,transparent 40%,rgba(255,255,255,0.03) 50%,transparent 60%)}
.dark .iv-jade-section h3{color:#a0d0c0;border-bottom-color:rgba(126,184,201,0.2)}
.dark .iv-jade-row .lbl{color:#8ab8a8}
.dark .iv-jade-row .val{color:#c0d8d0}
.dark .iv-jade-val{color:#c0d8d0}
.dark .iv-jade-body{color:#a0c8b8}
.dark .iv-jade-exp-item h6{color:#a0d0c0}
.dark .iv-spirit-bar{background:rgba(126,184,201,0.15)}
.dark .iv-spirit-bar-lbl{color:#8ab8a8}
.dark .iv-spirit-bar-num{color:#a0d0c0}
.dark .iv-spirit-bar-desc{color:#8ab8a8}
.dark .iv-jade-stat{background:rgba(255,255,255,0.02);border-color:rgba(126,184,201,0.15)}
.dark .iv-jade-stat .num{color:#a0d0c0}
.dark .iv-jade-stat .lbl{color:#8ab8a8}
.dark .iv-jade-tag{color:#a0d0c0;border-color:rgba(126,184,201,0.3);background:rgba(126,184,201,0.06)}
.dark .iv-jade-dev-row{border-bottom-color:rgba(126,184,201,0.1)}
.dark .iv-jade-dev-lbl{color:#a0d0c0}
.dark .iv-jade-dev-body{color:#a0c8b8}
.dark .iv-jade-exp{border-left-color:rgba(126,184,201,0.25)}
.dark .iv-jade-exp-item::before{background:#7eb8c9;border-color:#0a1a18}
.dark .iv-jade-exp-item p{color:#a0c8b8}
.dark .iv-jade-rev{background:rgba(255,255,255,0.02);color:#a0c8b8}
.dark .iv-jade-rev strong{color:#c0d8d0}
.dark .iv-note-prot,.dark .iv-note-self{color:#c8e0d4}
.dark .iv-note-prot{background:rgba(192,120,48,0.14)}
.dark .iv-note-self{background:rgba(126,184,201,0.14)}
.dark .iv-mist-corner{background:radial-gradient(ellipse at center,rgba(126,184,201,0.1),transparent 70%)}
.dark .iv-constellation .star{background:#7eb8c9}
.dark .iv-jade-section:nth-child(odd)::after{background:linear-gradient(30deg,transparent 45%,rgba(160,200,184,0.08) 45%,rgba(160,200,184,0.08) 47%,transparent 47%),linear-gradient(-20deg,transparent 50%,rgba(160,200,184,0.05) 50%,rgba(160,200,184,0.05) 52%,transparent 52%),linear-gradient(70deg,transparent 48%,rgba(160,200,184,0.06) 48%,rgba(160,200,184,0.06) 50%,transparent 50%)}
@media(max-width:600px){.iv-jade-section{margin:0 16px 10px}}
`;

  const parts: string[] = [];
  // 灵光粒子
  parts.push('<div class="iv-particle" style="top:60%;left:15%"></div><div class="iv-particle" style="top:70%;left:35%"></div><div class="iv-particle" style="top:50%;left:55%"></div><div class="iv-particle" style="top:80%;left:75%"></div><div class="iv-particle" style="top:65%;left:85%"></div>');

  // 顶轴
  parts.push('<div class="iv-jade-rod"></div>');

  // 天机头
  // 云雾缭绕四角 + 星宿连线
  parts.push('<div class="iv-mist-corner tl"></div><div class="iv-mist-corner tr"></div><div class="iv-mist-corner bl"></div><div class="iv-mist-corner br"></div>');
  // 星宿连线 — 7颗星 + SVG连线
  var constelHtml = '<div class="iv-constellation"><svg width="70" height="70" viewBox="0 0 70 70"><polyline points="10,15 25,8 40,20 55,10 60,30 45,45 20,40 10,15" fill="none" stroke="#4a90a4" stroke-width="0.6" opacity="0.5"/></svg>';
  var starPos = [[10,15],[25,8],[40,20],[55,10],[60,30],[45,45],[20,40]];
  for (var si=0;si<starPos.length;si++) {
    constelHtml += '<span class="star" style="left:'+starPos[si][0]+'px;top:'+starPos[si][1]+'px;animation-delay:'+(si*0.4)+'s"></span>';
  }
  constelHtml += '</div>';
  parts.push(constelHtml);
  parts.push('<div class="iv-celestial-header">');
  parts.push('<div class="iv-celestial-seal">天机玉简</div>');
  parts.push('<div class="iv-celestial-name">'+esc(data.name||charName)+'</div>');
  if (data.grade) {
    // 星级评定
    const gradeRank = data.grade.match(/(SSS|SS|S|A|B|C|D|E)/i);
    const starCount = gradeRank?({'SSS':7,'SS':6,'S':5,'A':4,'B':3,'C':2,'D':1,'E':0} as Record<string,number>)[gradeRank[1].toUpperCase()]??3:3;
    let stars = '';
    for (let i=0;i<5;i++) {
      stars += '<span class="iv-star" style="animation-delay:'+(i*0.2)+'s">'+(i<starCount?'★':'☆')+'</span>';
    }
    parts.push('<div style="margin:4px 0">'+stars+'</div>');
    parts.push('<div class="iv-celestial-grade">'+esc(data.grade)+'</div>');
  }
  if (data.globalRank) parts.push('<div class="iv-celestial-rank">天道排名 · 第'+esc(extractLeadingNumber(data.globalRank))+'位</div>');
  if (data.description) parts.push('<div class="iv-celestial-desc">'+esc(data.description)+'</div>');
  parts.push('</div>');

  // 基本档案
  parts.push('<div class="iv-jade-section"><h3><span class="ico">☰</span>基本灵录</h3>');
  if (data.sex||data.age) {
    parts.push('<div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:4px">');
    if (data.sex) parts.push('<span><span class="lbl" style="color:#5a8070;font-size:10px;letter-spacing:2px">性别</span> <span class="iv-jade-val">'+esc(data.sex)+'</span></span>');
    if (data.age) {
      const ac = ageColor(data.age,'#5a9080','#4a90a4','#4a90a4','#c07830');
      parts.push('<span><span class="lbl" style="color:#5a8070;font-size:10px;letter-spacing:2px">年岁</span> <span class="iv-age" style="color:'+ac+';font-weight:700">'+esc(data.age)+'</span></span>');
    }
    parts.push('</div>');
  }
  if (data.body) parts.push('<div class="iv-jade-body" style="font-size:12px">'+bn(esc(data.body))+'</div>');
  parts.push('</div>');

  // 外貌风格
  if (data.dailyClothes||data.privateClothes||data.makeup) {
    parts.push('<div class="iv-jade-section"><h3><span class="ico">☷</span>仙姿风仪</h3>');
    for (const [lbl,val] of [['日常仙裳',data.dailyClothes],['秘衣',data.privateClothes],['妆容',data.makeup]] as const) {
      if (val) parts.push('<div class="iv-jade-row"><span class="lbl">'+lbl+'</span><span class="val">'+esc(val)+'</span></div>');
    }
    parts.push('</div>');
  }

  // 心理 — 灵根评测
  parts.push('<div class="iv-jade-section"><h3><span class="ico">☵</span>心性灵根</h3>');
  if (data.orientation) parts.push('<div class="iv-jade-body" style="font-size:12px;margin-bottom:8px"><span style="color:#5a8070">道侣取向</span> '+esc(data.orientation)+'</div>');
  for (const [lbl,sv] of [['羞耻',data.shameIndex],['自信',data.confidenceIndex],['开放',data.opennessIndex]] as const) {
    if (sv) {
      parts.push('<div class="iv-spirit-bar-row"><span class="iv-spirit-bar-lbl">'+lbl+'</span><div class="iv-spirit-bar"><div class="iv-spirit-bar-fill" style="width:'+sv.score+'%"></div></div><span class="iv-spirit-bar-num">'+sv.score+'</span></div>');
      if (sv.desc) parts.push('<div class="iv-spirit-bar-desc">'+esc(sv.desc)+'</div>');
    }
  }
  if (data.coreFetishes.length>0) {
    parts.push('<div style="margin-top:6px"><span style="font-size:9px;color:#5a8070;letter-spacing:3px">本命灵根</span><div class="iv-jade-tags" style="margin-top:3px">'+data.coreFetishes.map(t=>'<span class="iv-jade-tag">◇ '+esc(t)+'</span>').join('')+'</div></div>');
  }
  parts.push('</div>');

  // 纯洁 — 玉洁净度
  parts.push('<div class="iv-jade-section"><h3><span class="ico">☳</span>玉洁净度</h3>');
  const pm4 = data.purityScore.match(/(\d+)/);
  const pv4 = pm4?parseInt(pm4[1],10):0;
  const rc4 = pv4<=25?'#c41e3a':pv4<=50?'#c07830':pv4<=75?'#7eb8c9':'#5a9080';
  parts.push('<div style="display:flex;align-items:center;gap:16px"><div style="width:80px;height:80px;border-radius:50%;border:3px solid '+rc4+';display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:'+rc4+';font-family:Georgia,serif;position:relative"><span style="position:absolute;top:-10px;font-size:8px;color:'+rc4+'">灵</span>'+pv4+'%</div><div style="flex:1">');
  if (data.isVirgin) parts.push('<div class="iv-jade-row"><span class="lbl">元贞</span><span class="val">'+esc(data.isVirgin)+'</span></div>');
  if (data.defloration&&data.defloration!=='无') parts.push('<div class="iv-jade-body" style="font-size:12px;margin-top:4px">'+esc(data.defloration)+'</div>');
  if (data.purityDetails) parts.push('<div class="iv-jade-body" style="font-size:11.5px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(126,184,201,0.15);line-height:1.8">'+bn(esc(data.purityDetails)).replace(/\n/g,'<br>')+'</div>');
  parts.push('</div></div></div>');

  // 性爱统计
  parts.push('<div class="iv-jade-section"><h3><span class="ico">☲</span>双修录</h3>');
  parts.push('<div class="iv-jade-stats">');
  if (data.sexCount) parts.push('<div class="iv-jade-stat"><div class="num">'+esc(extractLeadingNumber(data.sexCount)||data.sexCount)+'</div><div class="lbl">双修次数</div></div>');
  if (data.partnerCount || data.partnerGenderRatio) parts.push('<div class="iv-jade-stat"><div class="num">'+esc(objectCountNumber(data.partnerCount, data.partnerGenderRatio))+'</div><div class="lbl">道侣人数</div>'+objectGenderSubLine(data.partnerGenderRatio, data.partnerCount)+'</div>');
  if (data.frequency) parts.push('<div class="iv-jade-stat"><div class="num" style="font-size:15px;font-weight:700">'+esc(data.frequency)+'</div><div class="lbl">修行频率</div></div>');
  // 天道环图 — 如修真罗盘/星轨环形图
  var celestialColors = ['#4a8a78','#b06830','#8a6a30','#b89840','#4080a0','#5a7088','#9a4038','#8a6a48'];
  if (data.positionItems.length>0) parts.push('<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(90,144,128,0.12)"><span style="font-size:9px;color:#4a90a4;letter-spacing:3px">◇ 双修体位</span>'+renderDonutChart(data.positionItems,celestialColors,88,0.40)+'</div>');
  if (data.locationItems.length>0) parts.push('<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(90,144,128,0.12)"><span style="font-size:9px;color:#4a90a4;letter-spacing:3px">◇ 灵境分布</span>'+renderDonutChart(data.locationItems,celestialColors,88,0.40)+'</div>');
  // 道侣名录
  if (data.partnerList.length>0) {
    parts.push('<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(90,144,128,0.12)"><span style="font-size:9px;color:#4a90a4;letter-spacing:3px">◇ 道侣名录</span>');
    for (const p of data.partnerList) {
      parts.push('<div class="iv-jade-row" style="padding:4px 0;border-bottom:1px dotted rgba(90,144,128,0.12)"><span class="lbl" style="color:#2a6070;font-weight:600">'+esc(p.name)+'</span><span class="val">'+esc(p.identity)+' · '+esc(p.relationship)+(p.forced&&p.forced!=='无'?' · '+esc(p.forced):'')+(p.percentage?' · '+esc(p.percentage):'')+'</span></div>');
    }
    parts.push('</div>');
  }
  parts.push('</div>');
  parts.push('</div>');

  // 子嗣缘法
  if (hasPositiveCount(data.pregnancy) || hasPositiveCount(data.impregnate)) {
    parts.push('<div class="iv-jade-section"><h3><span class="ico">☳</span>子嗣缘法</h3>');
    if (hasPositiveCount(data.pregnancy)) {
      parts.push('<div class="iv-jade-dev-row"><span class="iv-jade-dev-lbl">孕产</span><span class="iv-jade-dev-body">'+bn(esc(data.pregnancy)).replace(/\n/g,'<br>')+'</span></div>');
      if (data.pregnancyDetails) parts.push('<div class="iv-jade-dev-row"><span class="iv-jade-dev-lbl">孕产明细</span><span class="iv-jade-dev-body">'+bn(esc(data.pregnancyDetails)).replace(/\n/g,'<br>')+'</span></div>');
    }
    if (hasPositiveCount(data.impregnate)) {
      parts.push('<div class="iv-jade-dev-row"><span class="iv-jade-dev-lbl">使人怀孕</span><span class="iv-jade-dev-body">'+bn(esc(data.impregnate)).replace(/\n/g,'<br>')+'</span></div>');
      if (data.impregnateDetails) parts.push('<div class="iv-jade-dev-row"><span class="iv-jade-dev-lbl">相关明细</span><span class="iv-jade-dev-body">'+bn(esc(data.impregnateDetails)).replace(/\n/g,'<br>')+'</span></div>');
    }
    parts.push('</div>');
  }

  // 开发状态
  const devF4 = ([['口部',data.devMouth],['手部',data.devHand],['足部',data.devFoot],['乳部',data.devBreast],['阳具',data.devPenis],['阴部',data.devVagina],['肛部',data.devAnal]] as [string,string][]).filter(([,v])=>v&&v!=='不适用');
  if (devF4.length>0) {
    parts.push('<div class="iv-jade-section"><h3><span class="ico">☴</span>灵体开发</h3>');
    for (const [lbl,txt] of devF4) {
      parts.push('<div class="iv-jade-dev-row"><span class="iv-jade-dev-lbl">'+lbl+'</span><span class="iv-jade-dev-body">'+bn(esc(txt))+'</span></div>');
    }
    parts.push('</div>');
  }

  // 经历
  const exps4: [string,string][] = [['初修',data.firstExp],['近修',data.lastExp],['极乐',data.bestExp]];
  const ve4 = exps4.filter(([,v])=>v&&v!=='无'&&v!=='暂无数据');
  if (ve4.length>0||(data.mastFirst&&data.mastFirst!=='无')||(data.mastWay&&data.mastWay!=='无')||data.mastCount||data.mastFreq) {
    parts.push('<div class="iv-jade-section"><h3><span class="ico">☶</span>修行记忆</h3><div class="iv-jade-exp">');
    for (const [lbl,txt] of ve4) parts.push('<div class="iv-jade-exp-item"><h6>'+lbl+'</h6><p>'+esc(txt)+'</p></div>');
    if (data.mastFirst&&data.mastFirst!=='无') parts.push('<div class="iv-jade-exp-item"><h6>初次独修</h6><p>'+esc(data.mastFirst)+'</p></div>');
    if (data.mastWay&&data.mastWay!=='无') parts.push('<div class="iv-jade-exp-item"><h6>独修法门</h6><p>'+esc(data.mastWay)+'</p></div>');
    parts.push('</div>');
    if (data.mastCount||data.mastFreq) {
      parts.push('<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(90,144,128,0.12);display:flex;gap:20px;flex-wrap:wrap;font-size:12px">');
      if (data.mastCount) parts.push('<span><span style="color:#5a8070;font-size:10px;letter-spacing:2px">独修次数</span> <span style="color:#2a6070;font-weight:700">'+esc(data.mastCount)+'</span></span>');
      if (data.mastFreq) parts.push('<span><span style="color:#5a8070;font-size:10px;letter-spacing:2px">独修频率</span> <span style="color:#2a6070;font-weight:700">'+esc(data.mastFreq)+'</span></span>');
      parts.push('</div>');
    }
    parts.push('</div>');
  }

  // 综合评估
  parts.push('<div class="iv-jade-section"><h3><span class="ico">☱</span>天道评鉴</h3>');
  if (data.charmTypes.length>0) parts.push('<div style="margin-bottom:6px"><span style="font-size:9px;color:#5a8070;letter-spacing:3px">灵韵类型</span><div class="iv-jade-tags" style="margin-top:3px">'+data.charmTypes.map(t=>'<span class="iv-jade-tag alt">◇ '+esc(t)+'</span>').join('')+'</div></div>');
  if (data.pornTags.length>0) parts.push('<div style="margin-bottom:6px"><span style="font-size:9px;color:#5a8070;letter-spacing:3px">阴阳分类</span><div class="iv-jade-tags" style="margin-top:3px">'+data.pornTags.map(t=>'<span class="iv-jade-tag">◇ '+esc(t)+'</span>').join('')+'</div></div>');
  if (data.bestPart) parts.push('<div class="iv-jade-row"><span class="lbl">仙骨之最</span><span class="val">'+esc(data.bestPart)+'</span></div>');
  if (data.voice) parts.push('<div class="iv-jade-row"><span class="lbl">仙音</span><span class="val">'+esc(data.voice).replace(/\n/g,'<br>')+'</span></div>');
  if (data.rankAdvantages) parts.push('<div style="font-size:11px;color:#5a9080;margin-bottom:2px">△ 天资　'+esc(data.rankAdvantages)+'</div>');
  if (data.rankDisadvantages) parts.push('<div style="font-size:11px;color:#c07830">▽ 业障　'+esc(data.rankDisadvantages)+'</div>');
  if (data.reviews) {
    parts.push('<div style="margin-top:8px"><span style="font-size:9px;color:#5a8070;letter-spacing:3px">三界流言</span>');
    const rvs = data.reviews.split(/[-\n]/).map(l=>l.trim()).filter(Boolean);
    for (const r of rvs) {
      const ci = r.search(/[：:]/);
      if (ci>0) parts.push('<div class="iv-jade-rev"><strong>'+esc(r.substring(0,ci).trim())+'</strong>：「'+esc(r.substring(ci+1).trim())+'」</div>');
      else parts.push('<div class="iv-jade-rev">「'+esc(r)+'」</div>');
    }
    parts.push('</div>');
  }
  if (data.protagonistNote) parts.push('<div class="iv-note-prot">◇ ' + esc(data.protagonistNote) + '</div>');
  if (data.characterSelfNote) parts.push('<div class="iv-note-self">◆ ' + esc(data.characterSelfNote) + '</div>');
  parts.push('</div>');

  // 底轴
  parts.push('<div class="iv-jade-rod" style="margin:0 28px 16px"></div>');

  return ivStyleOnce(css) +
    '<div class="iv-popup"><div class="iv-popup-body"><div class="iv-wrap">' +
    parts.join('') +
    '</div></div></div>';
}

// ===================================================================
// 深空舰桥 — 人员调查档案
// ===================================================================
export function renderBridgeDossier(data: InvestigationData, charName: string): string {
  const css = `
.iv-bridge{--ivb-bg:var(--bridge-panel,#eef3f5);--ivb-card:var(--bridge-panel-alt,#dde8eb);--ivb-text:var(--bridge-text,#16222c);--ivb-muted:var(--bridge-text-muted,#62757c);--ivb-line:var(--bridge-line,#91a5ad);--ivb-signal:var(--bridge-signal,#0a7189);--ivb-warn:var(--bridge-warn,#b47a16);color:var(--ivb-text);background:var(--ivb-bg);font-family:var(--bridge-font-ui,"Microsoft YaHei","PingFang SC",sans-serif);line-height:1.7}
.iv-bridge .ivb-head{display:grid;grid-template-columns:1fr auto;gap:12px;padding:18px 22px;background:var(--bridge-screen,#152b32);color:var(--bridge-screen-text,#8eeaff);border-bottom:1px solid var(--bridge-line-strong,#23758a)}
.iv-bridge .ivb-kicker,.iv-bridge .ivb-code{font:9px/1.4 var(--bridge-font-data,"Consolas",monospace);letter-spacing:1.5px}.iv-bridge .ivb-name{margin-top:5px;font-size:26px;font-weight:700;letter-spacing:3px}.iv-bridge .ivb-code{text-align:right}.iv-bridge .ivb-grade{display:inline-block;margin-top:5px;padding:2px 7px;border:1px solid var(--ivb-warn);color:var(--ivb-warn);font-size:10px}
.iv-bridge .ivb-desc{grid-column:1/-1;margin:0;padding-top:10px;border-top:1px solid rgba(142,234,255,.2);color:var(--bridge-screen-muted,#a3c2c9);font-size:12px}
.iv-bridge .ivb-body{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px;background-image:linear-gradient(rgba(35,117,138,.035) 1px,transparent 1px);background-size:100% 22px}
.iv-bridge .ivb-section{min-width:0;padding:12px;border:1px solid var(--ivb-line);border-left:3px solid var(--ivb-signal);background:var(--ivb-card)}.iv-bridge .ivb-wide{grid-column:1/-1}
.iv-bridge .ivb-title{display:flex;justify-content:space-between;gap:8px;margin:-2px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--ivb-line);color:var(--ivb-signal);font:700 11px/1.2 var(--bridge-font-data,"Consolas",monospace);letter-spacing:1px}.iv-bridge .ivb-title::after{content:"DATA BLOCK";color:var(--ivb-muted);font-size:8px;font-weight:400}
.iv-bridge .ivb-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.iv-bridge .ivb-field{padding:6px 8px;border:1px solid color-mix(in srgb,var(--ivb-line) 75%,transparent);background:var(--ivb-bg)}.iv-bridge .ivb-label{display:block;color:var(--ivb-muted);font:9px/1.3 var(--bridge-font-data,"Consolas",monospace);letter-spacing:.8px}.iv-bridge .ivb-value{display:block;margin-top:3px;font-size:12px;white-space:pre-line}
.iv-bridge .ivb-score{display:grid;grid-template-columns:72px 1fr 34px;gap:8px;align-items:center;margin:7px 0}.iv-bridge .ivb-score-label{font-size:10px;color:var(--ivb-muted)}.iv-bridge .ivb-track{height:7px;border:1px solid var(--bridge-line-strong,#23758a);background:var(--bridge-screen,#152b32)}.iv-bridge .ivb-fill{height:100%;background:var(--ivb-signal)}.iv-bridge .ivb-score-num{font:700 11px var(--bridge-font-data,"Consolas",monospace);color:var(--ivb-signal)}.iv-bridge .ivb-score-desc{grid-column:2/-1;margin-top:-5px;color:var(--ivb-muted);font-size:10px}
.iv-bridge .ivb-tags{display:flex;flex-wrap:wrap;gap:5px}.iv-bridge .ivb-tag{padding:2px 7px;border:1px solid var(--ivb-line);background:var(--ivb-bg);font-size:10px}.iv-bridge .ivb-tag.warn{border-color:var(--ivb-warn);color:var(--ivb-warn)}
.iv-bridge .ivb-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.iv-bridge .ivb-stat{padding:8px;border:1px solid var(--ivb-line);background:var(--ivb-bg);text-align:center}.iv-bridge .ivb-stat b{display:block;color:var(--ivb-signal);font:700 18px var(--bridge-font-data,"Consolas",monospace)}.iv-bridge .ivb-stat span{color:var(--ivb-muted);font-size:9px}
.iv-bridge .ivb-table{width:100%;border-collapse:collapse;font-size:10px}.iv-bridge .ivb-table th,.iv-bridge .ivb-table td{padding:5px 6px;border-bottom:1px solid var(--ivb-line);text-align:left}.iv-bridge .ivb-table th{color:var(--ivb-muted);font:9px var(--bridge-font-data,"Consolas",monospace);letter-spacing:.5px}
.iv-bridge .ivb-note{padding:8px 10px;border-left:3px solid var(--ivb-warn);background:var(--ivb-bg);white-space:pre-line;font-size:11px}.iv-bridge .ivb-note+.ivb-note{margin-top:6px;border-left-color:var(--ivb-signal)}
@media(max-width:599px){.iv-popup.bridge-module-investigation{width:100%;height:100vh;height:100dvh;max-width:none;max-height:none}.iv-bridge .ivb-head{padding:14px}.iv-bridge .ivb-body{grid-template-columns:1fr;padding:8px}.iv-bridge .ivb-wide{grid-column:auto}.iv-bridge .ivb-fields{grid-template-columns:1fr}.iv-bridge .ivb-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.iv-bridge .ivb-table{display:block;overflow-x:auto}}
`;
  const field = (label: string, value: string): string => value
    ? '<div class="ivb-field"><span class="ivb-label">' + esc(label) + '</span><span class="ivb-value">' + bn(esc(value)) + '</span></div>'
    : '';
  const section = (title: string, body: string, wide = false): string => body
    ? '<section class="ivb-section' + (wide ? ' ivb-wide' : '') + '"><div class="ivb-title">' + esc(title) + '</div>' + body + '</section>'
    : '';
  const score = (label: string, value: ScoreValue | null): string => value
    ? '<div class="ivb-score"><span class="ivb-score-label">' + esc(label) + '</span><span class="ivb-track"><span class="ivb-fill" style="width:' + Math.max(0, Math.min(100, value.score)) + '%"></span></span><span class="ivb-score-num">' + value.score + '</span>'
      + (value.desc ? '<span class="ivb-score-desc">' + esc(value.desc) + '</span>' : '') + '</div>'
    : '';
  const tags = (items: string[], warn = false): string => items.length
    ? '<div class="ivb-tags">' + items.map(item => '<span class="ivb-tag' + (warn ? ' warn' : '') + '">' + esc(item) + '</span>').join('') + '</div>'
    : '';
  // 本主题统计值原样显示（不做数字提取）；仅当男女分列来自专用字段时补注，避免与原文里的分列重复
  const ivbRatioText = data.partnerGenderRatio ? objectGenderRatioText(data.partnerGenderRatio, data.partnerCount) : '';
  const ivbObjectStat = data.partnerCount
    ? data.partnerCount + (ivbRatioText ? '（' + ivbRatioText + '）' : '')
    : ivbRatioText;
  const stats = [
    ['纯洁度', data.purityScore], ['经历', data.sexCount], ['对象', ivbObjectStat], ['频率', data.frequency],
  ].filter(([, value]) => value);
  const partners = data.partnerList.length
    ? '<div style="overflow-x:auto"><table class="ivb-table"><thead><tr><th>人员</th><th>身份</th><th>关系</th><th>强迫</th><th>占比</th></tr></thead><tbody>'
      + data.partnerList.map(item => '<tr><td>' + esc(item.name) + '</td><td>' + esc(item.identity) + '</td><td>' + esc(item.relationship) + '</td><td>' + esc(item.forced) + '</td><td>' + esc(item.percentage) + '</td></tr>').join('')
      + '</tbody></table></div>'
    : '';
  const development = [
    ['口部', data.devMouth], ['手部', data.devHand], ['足部', data.devFoot], ['乳部', data.devBreast],
    ['阳具', data.devPenis], ['阴部', data.devVagina], ['肛部', data.devAnal],
  ].map(([label, value]) => field(label, value)).join('');
  const experiences = [
    ['首次记录', data.firstExp], ['最近记录', data.lastExp], ['峰值记录', data.bestExp],
  ].map(([label, value]) => field(label, value)).join('');

  const html = '<div class="iv-popup bridge-window bridge-module-investigation"><div class="iv-popup-body"><div class="iv-wrap iv-bridge">'
    + '<header class="ivb-head"><div><div class="ivb-kicker">PERSONNEL INTELLIGENCE / 调查档案</div><div class="ivb-name">' + esc(data.name || charName) + '</div>'
    + (data.grade ? '<span class="ivb-grade">GRADE ' + esc(data.grade) + '</span>' : '') + '</div>'
    + '<div class="ivb-code">' + (data.globalRank ? 'RANK ' + esc(data.globalRank) : 'UNRANKED') + '<br>ACCESS: RESTRICTED</div>'
    + (data.description ? '<p class="ivb-desc">' + esc(data.description) + '</p>' : '') + '</header>'
    + '<main class="ivb-body">'
    + section('身份与体征 / IDENTITY', '<div class="ivb-fields">' + field('性别', data.sex) + field('年龄', data.age) + field('身体数据', data.body) + field('取向', data.orientation) + '</div>')
    + section('外观与着装 / APPEARANCE', '<div class="ivb-fields">' + field('日常着装', data.dailyClothes) + field('私密衣着', data.privateClothes) + field('妆容', data.makeup) + field('最佳部位', data.bestPart) + field('声音', data.voice) + '</div>')
    + section('心理遥测 / PSYCHOMETRICS', score('羞耻指数', data.shameIndex) + score('性自信', data.confidenceIndex) + score('性开放', data.opennessIndex) + tags(data.coreFetishes), true)
    + section('历史计数 / HISTORY', '<div class="ivb-stats">' + stats.map(([label, value]) => '<div class="ivb-stat"><b>' + esc(value) + '</b><span>' + esc(label) + '</span></div>').join('') + '</div>' + field('纯洁详情', data.purityDetails) + field('破处记录', data.defloration))
    + section('人员关联 / PARTNERS', partners, true)
    + section('偏好矩阵 / PREFERENCES', '<div class="ivb-fields">' + field('姿势', data.positions) + field('地点', data.locations) + '</div>' + tags(data.pornTags, true) + tags(data.charmTypes), true)
    + (hasPositiveCount(data.pregnancy) || hasPositiveCount(data.impregnate)
      ? section('生育记录 / REPRODUCTIVE', '<div class="ivb-fields">' + field('怀孕', hasPositiveCount(data.pregnancy) ? data.pregnancy : '') + field('怀孕详情', hasPositiveCount(data.pregnancy) ? data.pregnancyDetails : '') + field('使人怀孕', hasPositiveCount(data.impregnate) ? data.impregnate : '') + field('相关详情', hasPositiveCount(data.impregnate) ? data.impregnateDetails : '') + '</div>')
      : '')
    + section('开发状态 / DEVELOPMENT', '<div class="ivb-fields">' + development + '</div>')
    + section('关键经历 / EVENT LOG', '<div class="ivb-fields">' + experiences + field('自慰次数', data.mastCount) + field('自慰频率', data.mastFreq) + field('首次自慰', data.mastFirst) + field('方式', data.mastWay) + '</div>', true)
    + section('评议与结论 / ASSESSMENT', (data.reviews ? '<div class="ivb-note">' + esc(data.reviews) + '</div>' : '')
      + (data.protagonistNote ? '<div class="ivb-note">主角评议：' + esc(data.protagonistNote) + '</div>' : '')
      + (data.characterSelfNote ? '<div class="ivb-note">本人自评：' + esc(data.characterSelfNote) + '</div>' : '')
      + field('优势', data.rankAdvantages) + field('风险', data.rankDisadvantages), true)
    + '</main></div></div></div>';
  return ivStyleOnce(css) + html;
}

// ===================================================================
// 🧊 灵动玻璃 — 健康档案（iOS Health 风：大标题 + inset 分组 + 活动圆环 + 毛玻璃遮盖）
// ===================================================================
export function renderIosDossier(data: InvestigationData, charName: string): string {
  const css = `
.ios-iv{font-family:var(--ios-font,-apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC','Microsoft YaHei UI','Segoe UI',sans-serif);background:var(--ios-canvas,#f2f2f7);color:var(--ios-label,#1c1c1e);line-height:1.6;font-size:13px;position:relative;overflow:hidden;letter-spacing:0}
.ios-iv-hero{padding:26px 20px 18px}
.ios-iv-id{font:600 10.5px/1 var(--ios-font,sans-serif);color:var(--ios-label-3,rgba(60,60,67,.32));letter-spacing:1.2px;text-transform:uppercase;margin-bottom:6px}
.ios-iv-name{font-size:28px;font-weight:800;letter-spacing:-.6px;line-height:1.15}
.ios-iv-grade{display:inline-block;margin-top:8px;padding:4px 14px;border-radius:999px;background:var(--ios-accent,#007aff);color:#fff;font-size:12px;font-weight:700;letter-spacing:.5px}
.ios-iv-rank{margin-top:7px;font-size:11.5px;color:var(--ios-label-2,rgba(60,60,67,.62))}
.ios-iv-desc{margin-top:12px;padding:11px 14px;border-radius:14px;background:var(--ios-fill,rgba(120,120,128,.1));color:var(--ios-label-2,rgba(60,60,67,.62));font-size:12.5px;line-height:1.65}
.ios-iv-sec{margin:0;padding:6px 16px 18px}
.ios-iv-sec-t{font-size:12.5px;font-weight:700;color:var(--ios-label-2,rgba(60,60,67,.62));letter-spacing:.3px;margin:14px 14px 7px;padding:0 2px}
.ios-iv-list{background:var(--card,#f2f2f7);border-radius:14px;border:1px solid var(--ios-sep,rgba(60,60,67,.12));overflow:hidden}
.ios-iv-row{display:flex;align-items:baseline;gap:12px;padding:10px 14px;min-height:42px;box-sizing:border-box;border-bottom:1px solid var(--ios-sep,rgba(60,60,67,.12));font-size:13px}
.ios-iv-row:last-child{border-bottom:none}
.ios-iv-row .k{flex:0 0 auto;min-width:76px;color:var(--ios-label-2,rgba(60,60,67,.62));font-size:12px;font-weight:500}
.ios-iv-row .v{flex:1;min-width:0;font-weight:500;overflow-wrap:anywhere}
.ios-iv-row .v b{font-variant-numeric:tabular-nums}
/* 指标条（iOS 活动条） */
.ios-iv-meter{display:flex;align-items:center;gap:10px;padding:10px 14px}
.ios-iv-meter-k{flex:0 0 76px;text-align:right;font-size:11px;color:var(--ios-label-2,rgba(60,60,67,.62))}
.ios-iv-track{flex:1;height:6px;border-radius:3px;background:var(--ios-fill-2,rgba(120,120,128,.16));overflow:hidden}
.ios-iv-fill{height:100%;border-radius:3px;background:var(--ios-accent,#007aff);transition:width .7s var(--ios-ease-out,cubic-bezier(.25,.1,.25,1))}
.ios-iv-num{min-width:32px;font:700 12.5px/1 var(--ios-font,sans-serif);color:var(--ios-accent,#007aff);font-variant-numeric:tabular-nums}
.ios-iv-meter-d{padding:0 14px 8px 98px;font-size:10.5px;color:var(--ios-label-3,rgba(60,60,67,.32));line-height:1.5}
/* 纯洁活动圆环 */
.ios-iv-ring-wrap{display:flex;align-items:center;gap:16px;padding:14px}
.ios-iv-ring{position:relative;flex:0 0 76px;width:76px;height:76px;border-radius:50%;display:grid;place-items:center}
.ios-iv-ring::before{content:'';position:absolute;inset:-6px;border-radius:50%;background:var(--ios-fill-2,rgba(120,120,128,.16))}
.ios-iv-ring-num{position:relative;z-index:1;font:800 16px/1 var(--ios-font,sans-serif);font-variant-numeric:tabular-nums}
.ios-iv-tag{display:inline-block;padding:2px 10px;font-size:10.5px;font-weight:600;border-radius:999px;background:var(--ios-fill,rgba(120,120,128,.1));color:var(--ios-label-2,rgba(60,60,67,.62));margin:0 4px 4px 0}
.ios-iv-tag.acc{background:var(--ios-tint,rgba(0,122,255,.1));color:var(--ios-accent,#007aff)}
.ios-iv-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px 14px}
.ios-iv-stat{background:var(--ios-fill,rgba(120,120,128,.08));border-radius:12px;padding:10px 8px;text-align:center}
.ios-iv-stat .n{font-size:19px;font-weight:800;font-variant-numeric:tabular-nums}
.ios-iv-stat .l{font-size:9px;color:var(--ios-label-3,rgba(60,60,67,.32));letter-spacing:.8px;margin-top:3px;text-transform:uppercase}
.ios-iv-tbl{width:100%;border-collapse:collapse;font-size:11.5px;margin:4px 0 10px}
.ios-iv-tbl th{text-align:left;font-size:9.5px;font-weight:600;color:var(--ios-label-3,rgba(60,60,67,.32));letter-spacing:.6px;text-transform:uppercase;padding:6px 14px 4px}
.ios-iv-tbl td{padding:6px 14px;border-top:1px solid var(--ios-sep,rgba(60,60,67,.12));overflow-wrap:anywhere}
.ios-iv-note{margin:10px 14px;padding:10px 13px;border-radius:12px;font-size:12px;line-height:1.65}
.ios-iv-note.prot{background:var(--ios-tint,rgba(0,122,255,.1))}
.ios-iv-note.self{background:rgba(52,199,89,.1)}
.ios-iv-foot{text-align:center;padding:14px 20px 22px;font-size:9.5px;color:var(--ios-label-3,rgba(60,60,67,.32));letter-spacing:1px;text-transform:uppercase}
/* 毛玻璃遮盖 — 敏感数据（iOS 照片涂抹风） */
.iv-redact-blur{filter:blur(5px);cursor:pointer;transition:filter .25s ease;border-radius:5px;background:rgba(120,120,128,.07);padding:0 2px;user-select:none}
.iv-redact-blur:hover{filter:none;background:transparent}
/* 深色（token 翻转即可） */
.dark .ios-iv{background:#000}
.dark .ios-iv-stat{background:rgba(120,120,128,.2)}
@media(max-width:600px){.ios-iv-stats{grid-template-columns:1fr 1fr}.ios-iv-meter-d{padding-left:14px}}
`;

  const parts: string[] = [];
  parts.push('<div class="ios-iv-hero">');
  parts.push('<div class="ios-iv-id">健康档案 · ' + esc(charName) + '</div>');
  parts.push('<div class="ios-iv-name">' + esc(data.name || charName) + '</div>');
  if (data.grade) parts.push('<div class="ios-iv-grade">' + esc(data.grade) + '</div>');
  if (data.globalRank) parts.push('<div class="ios-iv-rank">' + esc(data.globalRank) + '</div>');
  if (data.description) parts.push('<div class="ios-iv-desc">' + esc(data.description) + '</div>');
  parts.push('</div>');

  // 基本档案
  parts.push('<div class="ios-iv-sec"><div class="ios-iv-sec-t">基本档案</div><div class="ios-iv-list">');
  if (data.sex) parts.push('<div class="ios-iv-row"><span class="k">性别</span><span class="v">' + esc(data.sex) + '</span></div>');
  if (data.age) {
    const ac = ageColor(data.age, '#34c759', '#007aff', '#ff9500', '#ff3b30');
    parts.push('<div class="ios-iv-row"><span class="k">年龄</span><span class="v" style="color:' + ac + ';font-weight:700">' + esc(data.age) + '</span></div>');
  }
  if (data.body) parts.push('<div class="ios-iv-row"><span class="k">身体</span><span class="v">' + bn(esc(data.body)) + '</span></div>');
  parts.push('</div></div>');

  // 外貌风格
  if (data.dailyClothes || data.privateClothes || data.makeup) {
    parts.push('<div class="ios-iv-sec"><div class="ios-iv-sec-t">外貌风格</div><div class="ios-iv-list">');
    for (const [lbl, val] of [['日常穿搭', data.dailyClothes], ['私密着装', data.privateClothes], ['妆容', data.makeup]] as const) {
      if (val) parts.push('<div class="ios-iv-row"><span class="k">' + lbl + '</span><span class="v">' + esc(val) + '</span></div>');
    }
    parts.push('</div></div>');
  }

  // 心理
  parts.push('<div class="ios-iv-sec"><div class="ios-iv-sec-t">心理状态</div><div class="ios-iv-list">');
  if (data.orientation) parts.push('<div class="ios-iv-row"><span class="k">性向</span><span class="v">' + esc(data.orientation) + '</span></div>');
  for (const [lbl, sv] of [['羞耻感', data.shameIndex], ['自信度', data.confidenceIndex], ['开放度', data.opennessIndex]] as const) {
    if (sv) {
      parts.push('<div class="ios-iv-meter"><span class="ios-iv-meter-k">' + lbl + '</span><div class="ios-iv-track"><div class="ios-iv-fill" style="width:' + sv.score + '%"></div></div><span class="ios-iv-num">' + sv.score + '</span></div>');
      if (sv.desc) parts.push('<div class="ios-iv-meter-d">' + esc(sv.desc) + '</div>');
    }
  }
  if (data.coreFetishes.length > 0) {
    parts.push('<div style="padding:4px 14px 12px">' + data.coreFetishes.map(t => '<span class="ios-iv-tag">#' + esc(t) + '</span>').join('') + '</div>');
  }
  parts.push('</div></div>');

  // 纯洁 — 活动圆环 + 毛玻璃遮盖
  const redact = (s: string) => '<span class="iv-redact-blur">' + bn(esc(s)).replace(/\n/g, '<br>') + '</span>';
  parts.push('<div class="ios-iv-sec"><div class="ios-iv-sec-t">纯洁档案 · 敏感</div><div class="ios-iv-list">');
  const pm = data.purityScore.match(/(\d+)/);
  const pv2 = pm ? parseInt(pm[1], 10) : 0;
  const rc2 = pv2 <= 25 ? '#ff3b30' : pv2 <= 50 ? '#ff9500' : pv2 <= 75 ? '#ff9500' : '#34c759';
  parts.push('<div class="ios-iv-ring-wrap">');
  parts.push('<div class="ios-iv-ring" style="background:conic-gradient(' + rc2 + ' ' + pv2 + '%, transparent ' + pv2 + '%)"><span class="ios-iv-ring-num" style="color:' + rc2 + '">' + pv2 + '%</span></div>');
  parts.push('<div style="flex:1;min-width:0">');
  if (data.isVirgin) parts.push('<div class="ios-iv-row" style="border-bottom:none;padding:0 0 6px"><span class="k">状态</span><span class="v">' + esc(data.isVirgin) + '</span></div>');
  if (data.defloration && data.defloration !== '无') {
    const deflorParts = data.defloration.split(/[,，]/);
    const redactedDeflor = deflorParts.map((p, i) => i === 1 ? redact(p.trim()) : esc(p.trim())).join(', ');
    parts.push('<div class="ios-iv-row" style="border-bottom:none;padding:0 0 6px"><span class="k">初次</span><span class="v">' + redactedDeflor + '</span></div>');
  }
  parts.push('</div></div>');
  if (data.purityDetails) parts.push('<div style="padding:0 14px 12px;font-size:12px;line-height:1.7;color:var(--ios-label-2,rgba(60,60,67,.62))">' + redact(data.purityDetails) + '</div>');
  parts.push('</div></div>');

  // 性爱统计
  parts.push('<div class="ios-iv-sec"><div class="ios-iv-sec-t">性爱统计</div><div class="ios-iv-list">');
  parts.push('<div class="ios-iv-stats">');
  // 男女分列随统计卡一同模糊（本主题统计数字均为机密模糊样式）
  var ivIosRatio = objectGenderRatioText(data.partnerGenderRatio, data.partnerCount);
  if (data.sexCount) parts.push('<div class="ios-iv-stat"><div class="n">' + redact(extractLeadingNumber(data.sexCount) || data.sexCount) + '</div><div class="l">总计</div></div>');
  if (data.partnerCount || data.partnerGenderRatio) parts.push('<div class="ios-iv-stat"><div class="n">' + redact(objectCountNumber(data.partnerCount, data.partnerGenderRatio)) + '</div><div class="l">伴侣</div>' + (ivIosRatio ? '<div style="font-size:9.5px;opacity:0.72;margin-top:3px;letter-spacing:0.5px">' + redact(ivIosRatio) + '</div>' : '') + '</div>');
  if (data.frequency) parts.push('<div class="ios-iv-stat"><div class="n" style="font-size:13px;padding-top:5px">' + esc(data.frequency) + '</div><div class="l">频率</div></div>');
  parts.push('</div>');
  if (data.positionItems.length > 0) {
    parts.push('<div style="padding:0 14px 8px"><div style="font-size:10px;color:var(--ios-label-3,rgba(60,60,67,.32));letter-spacing:.6px;margin-bottom:6px">体位偏好</div>' + renderThinBars(data.positionItems, ['#007aff', '#34c759', '#ff9500', '#ff375f', '#5e5ce6', '#64d2ff', '#ff2d55', '#30d158']) + '</div>');
  }
  if (data.locationItems.length > 0) {
    parts.push('<div style="padding:0 14px 12px"><div style="font-size:10px;color:var(--ios-label-3,rgba(60,60,67,.32));letter-spacing:.6px;margin-bottom:6px">地点分布</div>' + renderThinBars(data.locationItems, ['#007aff', '#34c759', '#ff9500', '#ff375f', '#5e5ce6', '#64d2ff', '#ff2d55', '#30d158']) + '</div>');
  }
  if (data.partnerList.length > 0) {
    parts.push('<div style="overflow-x:auto"><table class="ios-iv-tbl"><thead><tr><th>姓名</th><th>身份</th><th>关系</th><th>强迫</th><th>占比</th></tr></thead><tbody>'
      + data.partnerList.map(function (p) { return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.identity) + '</td><td>' + esc(p.relationship) + '</td><td>' + esc(p.forced) + '</td><td>' + redact(p.percentage) + '</td></tr>'; }).join('')
      + '</tbody></table></div>');
  }
  parts.push('</div></div>');

  // 生育记录
  if (hasPositiveCount(data.pregnancy) || hasPositiveCount(data.impregnate)) {
    parts.push('<div class="ios-iv-sec"><div class="ios-iv-sec-t">生育记录 · 敏感</div><div class="ios-iv-list">');
    if (hasPositiveCount(data.pregnancy)) {
      parts.push('<div class="ios-iv-row"><span class="k">怀孕</span><span class="v">' + redact(data.pregnancy) + '</span></div>');
      if (data.pregnancyDetails) parts.push('<div class="ios-iv-row"><span class="k">详情</span><span class="v">' + bn(esc(data.pregnancyDetails)).replace(/\n/g, '<br>') + '</span></div>');
    }
    if (hasPositiveCount(data.impregnate)) {
      parts.push('<div class="ios-iv-row"><span class="k">使孕</span><span class="v">' + redact(data.impregnate) + '</span></div>');
      if (data.impregnateDetails) parts.push('<div class="ios-iv-row"><span class="k">详情</span><span class="v">' + bn(esc(data.impregnateDetails)).replace(/\n/g, '<br>') + '</span></div>');
    }
    parts.push('</div></div>');
  }

  // 开发
  const devF = ([['口腔', data.devMouth], ['手', data.devHand], ['足', data.devFoot], ['胸', data.devBreast], ['阴茎', data.devPenis], ['阴道', data.devVagina], ['肛门', data.devAnal]] as [string, string][]).filter(([, v]) => v && v !== '不适用');
  if (devF.length > 0) {
    parts.push('<div class="ios-iv-sec"><div class="ios-iv-sec-t">开发状态</div><div class="ios-iv-list">');
    for (const [lbl, txt] of devF) {
      parts.push('<div class="ios-iv-row"><span class="k">' + lbl + '</span><span class="v">' + bn(esc(txt)) + '</span></div>');
    }
    parts.push('</div></div>');
  }

  // 经历
  const exps: [string, string][] = [['初次经历', data.firstExp], ['最近经历', data.lastExp], ['最佳经历', data.bestExp]];
  const ve = exps.filter(([, v]) => v && v !== '无' && v !== '暂无数据');
  if (ve.length > 0 || (data.mastFirst && data.mastFirst !== '无') || (data.mastWay && data.mastWay !== '无')) {
    parts.push('<div class="ios-iv-sec"><div class="ios-iv-sec-t">经历</div><div class="ios-iv-list">');
    for (const [lbl, txt] of ve) parts.push('<div class="ios-iv-row"><span class="k">' + lbl + '</span><span class="v">' + esc(txt) + '</span></div>');
    if (data.mastFirst && data.mastFirst !== '无') parts.push('<div class="ios-iv-row"><span class="k">初次自慰</span><span class="v">' + esc(data.mastFirst) + '</span></div>');
    if (data.mastWay && data.mastWay !== '无') parts.push('<div class="ios-iv-row"><span class="k">方式</span><span class="v">' + esc(data.mastWay) + '</span></div>');
    if (data.mastCount || data.mastFreq) {
      parts.push('<div class="ios-iv-row"><span class="k">自慰</span><span class="v">' + (data.mastCount ? redact(data.mastCount) : '') + (data.mastCount && data.mastFreq ? ' · ' : '') + (data.mastFreq ? esc(data.mastFreq) : '') + '</span></div>');
    }
    parts.push('</div></div>');
  }

  // 评估
  parts.push('<div class="ios-iv-sec"><div class="ios-iv-sec-t">综合评估</div><div class="ios-iv-list">');
  if (data.charmTypes.length > 0) parts.push('<div style="padding:10px 14px 4px">' + data.charmTypes.map(t => '<span class="ios-iv-tag acc">' + esc(t) + '</span>').join('') + '</div>');
  if (data.pornTags.length > 0) parts.push('<div style="padding:4px 14px">' + data.pornTags.map(t => '<span class="ios-iv-tag">' + esc(t) + '</span>').join('') + '</div>');
  if (data.bestPart) parts.push('<div class="ios-iv-row"><span class="k">最佳部位</span><span class="v">' + esc(data.bestPart) + '</span></div>');
  if (data.voice) parts.push('<div class="ios-iv-row"><span class="k">声音</span><span class="v">' + esc(data.voice).replace(/\n/g, '<br>') + '</span></div>');
  if (data.rankAdvantages) parts.push('<div class="ios-iv-row"><span class="k">优势</span><span class="v" style="color:#34c759">▲ ' + esc(data.rankAdvantages) + '</span></div>');
  if (data.rankDisadvantages) parts.push('<div class="ios-iv-row"><span class="k">劣势</span><span class="v" style="color:#ff3b30">▼ ' + esc(data.rankDisadvantages) + '</span></div>');
  if (data.reviews) {
    const rvs = data.reviews.split(/[-\n]/).map(l => l.trim()).filter(Boolean);
    for (const r of rvs) {
      const ci = r.search(/[：:]/);
      if (ci > 0) parts.push('<div class="ios-iv-row"><span class="k">' + esc(r.substring(0, ci).trim()) + '</span><span class="v">' + esc(r.substring(ci + 1).trim()) + '</span></div>');
      else parts.push('<div class="ios-iv-row"><span class="k">传闻</span><span class="v">' + esc(r) + '</span></div>');
    }
  }
  if (data.protagonistNote) parts.push('<div class="ios-iv-note prot"><b>主角评价</b><br>' + esc(data.protagonistNote) + '</div>');
  if (data.characterSelfNote) parts.push('<div class="ios-iv-note self"><b>角色自评</b><br>' + esc(data.characterSelfNote) + '</div>');
  parts.push('</div></div>');

  parts.push('<div class="ios-iv-foot">档案 · ' + new Date().getFullYear() + ' · 统一状态栏</div>');

  return ivStyleOnce(css) +
    '<div class="iv-popup"><div class="iv-popup-body"><div class="ios-iv">' +
    parts.join('') +
    '</div></div></div>';
}

// ===== 导出主题映射 =====
import type { StyleType } from '../core/constants';
export function renderThemedDossier(data: InvestigationData, charName: string, style: StyleType): string {
  switch (style) {
    case 'ancient': return renderAncientDossier(data, charName);
    case 'flirtatious': return renderFlirtatiousDossier(data, charName);
    case 'minimal': return renderMinimalDossier(data, charName);
    case 'sweet': return renderSweetDossier(data, charName);
    case 'xianxia': return renderXianxiaDossier(data, charName);
    case 'bridge': return renderBridgeDossier(data, charName);
    case 'ios': return renderIosDossier(data, charName);
    default: return renderAncientDossier(data, charName);
  }
}
