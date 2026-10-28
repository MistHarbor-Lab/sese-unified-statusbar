// ===== 商店弹窗 UI（5 主题作用域 + 深色 + 移动端） =====
// 模板来源：renderers/achievement-ui.ts（主题作用域 + CSS 懒注入 + syncDarkClass*）。
// 布局/稀有度/装饰规格见 docs/superpowers/specs/2026-07-05-shop-feature-design.md §6。
import { type StyleType } from '../core/constants';
import { ubIcon } from '../core/icons';
import { readSerseEnergy } from '../core/energy-payment';
import { getConfig } from '../core/config-store';
import { syncDarkClass, syncDarkClassMinimal, closePanelOverlay, guardGhostClick, markPopupShown } from './html-builder';
import { ensureStyleOnce } from './style-once';
import { confirmMessage } from './confirm-dialog';
import { ensureRegularShop, manualRefreshRegular, buyRegularItem, buyRegularSkillItem, buyRegularWardrobeItem, getRegularItems } from '../core/shop-regular';
import { performStorySaleGeneration, buyStoryItem, getStoryItems, setStoryItems, findOwnedSkill } from '../core/shop-story-ai';
import { performGachaDraw, performGachaDraw10 } from '../core/gacha';
import {
  loadShopData, type ShopRegularItem, type ShopStoryItem,
} from '../core/shop-store';
import { GACHA_COST, GACHA10_COST, SHOP_REFRESH_COST, SHOP_REFRESH_LONG_PRESS_COST } from '../core/constants';
import { getWardrobeSnapshot } from '../core/wardrobe-store';
import { wardrobeDedupeKey, type WardrobeCategory } from '../core/wardrobe-types';
import { escapeHtmlAttr as escapeHtml } from '../core/html-escape';
import { readExtraPromptCache, writeExtraPromptCache, EXTRA_PROMPT_CACHE_KEYS } from '../core/extra-prompt-cache';
import { bindLongPress, swallowGhostClickIfPointerActive } from './long-press';

let _currentTab: 'regular' | 'story' = 'regular';
let _onCloseRender: (() => void) | null = null;

/** 5 主题文案 map（spec §6.6） */
const THEME_TEXT: Record<StyleType, {
  title: string; tabRegular: string; tabStory: string;
  refresh: string; draw: string; draw10: string; buy: string; energyIcon: string;
}> = {
  ancient:     { title: '求宝阁',    tabRegular: '常规售卖', tabStory: '剧情特卖', refresh: ubIcon('refresh') + ' 刷新', draw: ubIcon('gem') + ' 求签',   draw10: '十连求签',  buy: '收下',     energyIcon: ubIcon('bolt') },
  flirtatious: { title: '心动商店',  tabRegular: '常规售卖', tabStory: '剧情特卖', refresh: ubIcon('refresh') + ' 刷新', draw: ubIcon('dice') + ' 单抽', draw10: ubIcon('dice') + ' 十连', buy: ubIcon('bag') + ' 购买', energyIcon: ubIcon('bolt') },
  sweet:       { title: '甜蜜小铺',  tabRegular: '常规售卖', tabStory: '剧情特卖', refresh: '🔄 刷新', draw: '💕 心动抽', draw10: '十连心动',  buy: '🛒 带走',  energyIcon: '⚡' },
  xianxia:     { title: '洞天集市',  tabRegular: '常规售卖', tabStory: '剧情特卖', refresh: ubIcon('refresh') + ' 刷新', draw: ubIcon('gem') + ' 探宝',   draw10: '十连探宝',            buy: '请回',     energyIcon: ubIcon('bolt') },
  minimal:     { title: 'Shop',      tabRegular: 'Regular',  tabStory: 'Story',    refresh: 'Refresh', draw: 'Draw',     draw10: 'Draw ×10',            buy: 'Buy',      energyIcon: ubIcon('bolt') },
  bridge:      { title: '补给与交易终端', tabRegular: '常规补给', tabStory: '剧情特供', refresh: '刷新货单', draw: '单次征调', draw10: '十次征调', buy: '确认入库', energyIcon: ubIcon('bolt') },
  ios:         { title: '补给商店',  tabRegular: '常规售卖', tabStory: '剧情特卖', refresh: '刷新',     draw: '单抽',     draw10: '十连抽',    buy: '购买',     energyIcon: ubIcon('bolt') },
};

/** 卡池品质名 → 主题品质名（spec §6.2，0-5 档） */
const QUALITY_NAMES: Record<StyleType, string[]> = {
  ancient:     ['凡品', '佳品', '异品', '奇品', '瑰品', '絕品'],
  flirtatious: ['寻常', '心动', '迷人', '魅惑', '销魂', '绝品'],
  sweet:       ['软糖', '奶油', '草莓', '蜜桃', '星尘', '神迹'],
  xianxia:     ['凡器', '灵器', '法器', '寶器', '仙器', '神器'],
  minimal:     ['Ordinary', 'Fine', 'Rare', 'Epic', 'Legend', 'Myth'],
  bridge:      ['标准', '改良', '稀有', '史诗', '传奇', '神话'],
  ios:         ['普通', '良好', '稀有', '史诗', '传说', '神话'],
};
/** 卡池 quality 中文 → rank 0-5 */
function qualityToRank(q: string): number {
  return ['普通', '优秀', '稀有', '史诗', '传说', '神话'].indexOf(q);
}

const SHOP_CSS = `
.shop-popup{display:flex;flex-direction:column;max-width:min(90vw,480px);max-height:70vh;width:100%;
  background:var(--ub-popup-bg,var(--card,#fff));border:var(--ub-popup-border,1px solid #ddd);
  border-radius:var(--ub-popup-radius,12px);box-shadow:var(--ub-popup-shadow,0 8px 32px rgba(0,0,0,0.3));
  overflow:hidden;font-size:13px;}
.shop-popup.shop-entering{animation:popup-in .25s ease;}
@keyframes popup-in{from{opacity:0;transform:scale(.92) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
.shop-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;
  background:var(--ub-popup-head-bg,var(--card));border-bottom:var(--ub-popup-head-border,1px solid var(--divider,#ddd));position:relative;}
.shop-title{font-weight:600;letter-spacing:1.5px;display:flex;align-items:center;gap:6px;}
.shop-close{background:none;border:none;font-size:20px;cursor:pointer;line-height:1;color:var(--text,#333);opacity:.7;}
.shop-close:hover{opacity:1;}
.shop-tabs{display:flex;padding:0 16px;gap:4px;background:rgba(0,0,0,0.02);border-bottom:1px solid var(--divider,#eee);}
.shop-tab{padding:10px 14px;font-size:12px;cursor:pointer;border-bottom:2px solid transparent;color:var(--text-muted,#888);}
.shop-tab.on{font-weight:600;border-bottom-color:var(--accent,var(--text,#333));color:var(--text,#333);}
.shop-tab-count{font-size:10px;opacity:.7;margin-left:2px;}
.shop-bar{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--divider,#eee);}
.shop-energy{display:flex;align-items:center;gap:3px;padding:4px 10px;border-radius:20px;font-weight:700;font-size:13px;
  background:rgba(128,128,128,0.08);border:1px solid var(--divider,#ddd);}
.shop-actions{display:flex;gap:5px;margin-left:auto;}
.shop-btn{padding:5px 10px;font-size:11px;cursor:pointer;border-radius:20px;font-weight:600;display:flex;align-items:center;gap:3px;
  border:1px solid var(--accent,#888);background:transparent;color:var(--text,#333);transition:all .15s;}
.shop-btn:hover{background:var(--accent,#888);color:var(--accent-ink,#fff);}
.shop-btn.primary{background:var(--accent,#888);color:var(--accent-ink,#fff);border-color:var(--accent,#888);}
.shop-btn .cost{font-size:9px;opacity:.8;margin-left:2px;}
.shop-body{flex:1;overflow-y:auto;padding:10px 12px 14px;}
.shop-empty{padding:40px 20px;text-align:center;color:var(--text-muted,#999);font-size:13px;line-height:1.7;}
.shop-empty .icon{font-size:32px;margin-bottom:8px;}
/* 剧情特卖长按额外提示词弹窗 */
.shop-extra-popup{max-width:520px;}
.shop-extra-wrap{padding:14px 16px;display:flex;flex-direction:column;gap:10px;}
.shop-extra-label{font-size:12px;color:var(--text-muted,#888);line-height:1.6;}
.shop-extra-label b{color:var(--accent,#888);}
.shop-extra-textarea{width:100%;min-height:120px;resize:vertical;font-size:13px;line-height:1.6;padding:10px 12px;
  border:1px solid var(--divider,#ccc);border-radius:8px;background:var(--card,#fff);color:var(--text,#333);font-family:inherit;box-sizing:border-box;}
.shop-extra-textarea:focus{outline:none;border-color:var(--accent,#888);}
.shop-extra-btns{display:flex;gap:8px;justify-content:flex-end;padding:0 16px 16px;}
.shop-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;}
@media(max-width:480px){.shop-skill-card{min-height:124px}.shop-grid{grid-template-columns:repeat(auto-fill,minmax(100px,1fr));}.shop-actions{gap:4px;}.shop-btn{white-space:nowrap;}}
.shop-card{padding:10px 8px 8px;border-radius:8px;text-align:center;cursor:pointer;position:relative;overflow:hidden;
  display:flex;flex-direction:column;min-height:130px;transition:transform .15s,box-shadow .15s;}
.shop-card:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(128,128,128,0.25);}
.shop-stars{font-size:10px;letter-spacing:1.5px;margin-bottom:4px;}
.shop-quality{font-size:9px;opacity:.65;letter-spacing:1px;}
.shop-name{font-weight:600;font-size:12px;margin:5px 0;flex:1;display:flex;align-items:center;justify-content:center;line-height:1.3;}
.shop-price{font-weight:700;font-size:13px;color:var(--accent,#888);}
.shop-price-strike{text-decoration:line-through;opacity:.5;font-size:10px;font-weight:400;margin-right:4px;}
.shop-deco{position:absolute;top:4px;right:5px;font-size:12px;z-index:3;}
.shop-sale{position:absolute;top:6px;left:-1px;color:#fff;font-size:9px;font-weight:700;padding:2px 6px 2px 5px;
  border-radius:0 3px 3px 0;z-index:4;}
/* 稀有度分档（共享骨架，色板由主题作用域覆盖） */
.shop-r0{background:rgba(128,128,128,0.08);}
.shop-r1{background:rgba(128,128,128,0.05);}
.shop-r2{background:rgba(128,128,128,0.04);border:1px solid var(--divider,#ccc);}
.shop-r3{border:1px solid var(--accent,#888);box-shadow:0 2px 8px rgba(0,0,0,0.1);}
.shop-r4{border:1.5px solid var(--accent,#888);box-shadow:0 0 10px rgba(0,0,0,0.15);}
.shop-r5{border:1.5px solid var(--accent,#888);box-shadow:0 0 16px rgba(0,0,0,0.2);}
/* 技能商品：秘典流光卡（不复用普通商品价格稀有度） */
.shop-skill-card{isolation:isolate;border:1.5px solid var(--accent,#8d6a3f);
  background:linear-gradient(145deg,var(--card,#fff),rgba(128,96,48,.12));box-shadow:0 0 0 2px rgba(128,96,48,.18),0 8px 20px rgba(40,28,16,.16);}
.shop-skill-card::before{content:'';position:absolute;inset:4px;border:1px solid currentColor;border-radius:5px;opacity:.28;pointer-events:none;z-index:0;}
.shop-skill-card::after{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 43%,rgba(255,240,180,.28),transparent 42%);pointer-events:none;z-index:0;}
.shop-skill-card>*{position:relative;z-index:1;}
.shop-skill-badge{position:absolute;left:5px;top:5px;padding:2px 6px;border-radius:8px;font-size:9px;font-weight:700;letter-spacing:1px;
  color:#fff;background:var(--accent,#8d6a3f);}
.shop-skill-sigil{width:38px;height:38px;margin:8px auto 3px;border:1px solid currentColor;border-radius:50%;display:grid;place-items:center;
  font-size:19px;line-height:1;box-shadow:inset 0 0 0 4px rgba(255,255,255,.18),0 0 12px currentColor;}
.shop-skill-meta{font-size:9px;letter-spacing:1px;opacity:.72;margin-top:-1px;}
.shop-skill-status{font-size:9px;margin-top:2px;color:var(--text-muted,#777);}
.shop-skill-card.is-skill-disabled{filter:saturate(.55);opacity:.82;}
.shop-skill-card.is-skill-disabled .shop-skill-status{font-weight:700;color:var(--accent-deep,var(--accent,#8d6a3f));}
/* 详情卡 */
.shop-detail-head{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--divider,#eee);}
.shop-detail-back{cursor:pointer;font-weight:600;}
.shop-detail-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;}
.shop-detail-banner{padding:20px 16px 24px;text-align:center;border-bottom:1px solid var(--divider,#eee);}
.shop-detail-name{font-size:20px;font-weight:700;margin:6px 0;}
.shop-detail-desc{padding:16px;font-size:13px;line-height:1.7;}
.shop-detail-footer{flex:0 0 auto;padding:0 16px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;}
.shop-skill-detail-banner{position:relative;overflow:hidden;}
.shop-skill-effect{margin:14px 16px 8px;padding:12px 14px;border-left:3px solid var(--accent,#8d6a3f);background:rgba(128,128,128,.07);line-height:1.7;}
.shop-skill-effect-title{font-size:10px;font-weight:700;letter-spacing:2px;opacity:.68;margin-bottom:5px;}
.shop-skill-note{margin:0 16px 14px;font-size:11px;line-height:1.6;color:var(--text-muted,#777);}
.shop-skill-owned{margin-top:6px;font-weight:700;color:var(--accent-deep,var(--accent,#8d6a3f));}
.shop-btn:disabled{cursor:not-allowed;opacity:.48;filter:saturate(.4);}
`;

/** 5 主题作用域 CSS（spec §6.2-6.3 装饰符/色板/神话档华丽度） */
const THEME_SCOPED_CSS = `
/* 古风 */
.shop-popup.shop-theme-ancient{font-family:var(--ub-font-ui);border-radius:2px;}
.shop-popup.shop-theme-ancient .shop-title{font-family:var(--ub-font-reading);font-weight:600;color:var(--accent-deep,#8b1a12);font-size:17px;letter-spacing:3px;}
.shop-popup.shop-theme-ancient .shop-r5{background:radial-gradient(ellipse at 30% 25%,rgba(255,240,200,0.75),transparent 55%),radial-gradient(ellipse at center,#ffe8c0,var(--card,#f5edd6) 60%,var(--accent-soft,#e8c8b8) 100%);border:1.5px solid var(--seal-red,#b5362e);box-shadow:0 0 0 2px rgba(201,168,76,0.35),0 0 20px rgba(181,54,46,0.35),2px 2px 0 rgba(181,54,46,0.4);}
.shop-popup.shop-theme-ancient .shop-r5::after{content:'';position:absolute;inset:3px;border:1px double rgba(181,54,46,0.35);border-radius:4px;pointer-events:none;}
.shop-popup.shop-theme-ancient .shop-sale{background:linear-gradient(135deg,var(--seal-red,#b5362e),var(--accent-deep,#8b1a12));}
.shop-popup.shop-theme-ancient .shop-skill-card{color:var(--accent-deep,#8b1a12);background:linear-gradient(145deg,var(--card,#f5edd6),rgba(201,168,76,.24));border-color:var(--seal-red,#b5362e);box-shadow:0 0 0 2px rgba(201,168,76,.3),2px 3px 0 rgba(139,26,18,.22);}
/* 瑟瑟 */
.shop-popup.shop-theme-flirtatious .shop-r3{background:linear-gradient(180deg,var(--accent-bg-faint,rgba(208,96,160,0.08)),var(--lust-bg,rgba(144,80,192,0.06)));border:1px solid var(--lust-soft,#d8c0f0);}
.shop-popup.shop-theme-flirtatious .shop-r4{background:linear-gradient(180deg,var(--accent-bg,rgba(208,96,160,0.1)),var(--lust-bg-strong,rgba(144,80,192,0.15)));border:1.5px solid var(--accent,#d060a0);}
.shop-popup.shop-theme-flirtatious .shop-r5{background:linear-gradient(135deg,var(--accent-soft,#f0c0d8) 0%,var(--lust-soft,#d8c0f0) 40%,var(--lust,#9050c0) 100%);border:1.5px solid var(--accent-deep,#ff89b3);}
.shop-popup.shop-theme-flirtatious .shop-r5 .shop-deco{color:var(--accent-deep,#ff89b3);animation:shop-neon 1.6s ease-in-out infinite;}
@keyframes shop-neon{0%,100%{opacity:.9;text-shadow:0 0 4px currentColor;}50%{opacity:1;text-shadow:0 0 10px currentColor,0 0 16px currentColor;}}
.shop-popup.shop-theme-flirtatious .shop-sale{background:linear-gradient(135deg,var(--accent-deep,#b04878),var(--accent,#d060a0));}
.shop-popup.shop-theme-flirtatious .shop-skill-card{color:var(--accent-deep,#b04878);background:linear-gradient(145deg,var(--card,#fff),rgba(208,96,160,.18),rgba(144,80,192,.15));border-color:var(--lust,#9050c0);box-shadow:0 0 0 2px rgba(255,137,179,.2),0 0 20px rgba(144,80,192,.25);}
/* 甜恋 */
.shop-popup.shop-theme-sweet{font-family:'ZCOOL KuaiLe','Microsoft YaHei','PingFang SC','Heiti SC','Noto Sans SC','Noto Sans CJK SC','Source Han Sans SC','PingFang SC','Microsoft YaHei','Heiti SC','WenQuanYi Micro Hei',sans-serif;border-radius:18px;}
.shop-popup.shop-theme-sweet .shop-card{border-radius:14px;}
.shop-popup.shop-theme-sweet .shop-r3{background:linear-gradient(135deg,var(--sweet-pink-light,#ffe0ea),var(--sweet-mint-light,#e0fff0));border:1.5px solid var(--sweet-mint,#b8e8d0);}
.shop-popup.shop-theme-sweet .shop-r5{background:linear-gradient(135deg,var(--sweet-pink-light,#ffe0ea) 0%,var(--sweet-lavender-light,#f0e8ff) 50%,var(--sweet-mint-light,#e0fff0) 100%);border:2px solid var(--sweet-pink,#ff8fab);box-shadow:0 4px 16px rgba(255,143,171,0.4);}
.shop-popup.shop-theme-sweet .shop-r5 .shop-deco{color:var(--sweet-pink,#ff8fab);animation:shop-heart 1.2s ease-in-out infinite;}
@keyframes shop-heart{0%,100%{transform:scale(1);}50%{transform:scale(1.25);}}
.shop-popup.shop-theme-sweet .shop-sale{background:linear-gradient(135deg,var(--sweet-pink,#ff8fab),var(--sweet-pink-deep,#e87090));}
.shop-popup.shop-theme-sweet .shop-skill-card{color:var(--sweet-pink-deep,#e87090);background:linear-gradient(145deg,var(--sweet-pink-light,#ffe0ea),var(--sweet-lavender-light,#f0e8ff),var(--sweet-mint-light,#e0fff0));border:2px solid var(--sweet-pink,#ff8fab);box-shadow:0 0 0 2px rgba(255,255,255,.7),0 6px 16px rgba(255,143,171,.3);}
/* 云海仙踪 */
.shop-popup.shop-theme-xianxia{font-family:var(--ub-font-ui);}
.shop-popup.shop-theme-xianxia .shop-title{font-family:var(--ub-font-reading);font-weight:600;color:var(--jade-deep,#5a9078);font-size:17px;letter-spacing:3px;}
.shop-popup.shop-theme-xianxia .shop-r3{background:linear-gradient(175deg,var(--jade-surface-1,#f4faf6),#d8e8dc);border:1px solid var(--jade-deep,#5a9078);}
.shop-popup.shop-theme-xianxia .shop-r5{background:radial-gradient(ellipse at 30% 20%,rgba(255,240,200,0.7),transparent 60%),radial-gradient(ellipse at 70% 80%,rgba(200,240,220,0.6),transparent 55%),radial-gradient(ellipse at center,#f8fef0,#ecfaf0 40%,#dcecdc 100%);border:1.5px solid var(--gold,#b89848);box-shadow:0 0 0 2px rgba(184,152,72,0.4),0 0 0 4px rgba(90,144,120,0.25),0 0 24px rgba(184,152,72,0.5),inset 0 0 20px rgba(255,240,180,0.4);}
.shop-popup.shop-theme-xianxia .shop-r5::before{content:'';position:absolute;inset:-6px;border:1px dashed rgba(184,152,72,0.4);border-radius:50%;animation:shop-halo 12s linear infinite;pointer-events:none;}
@keyframes shop-halo{to{transform:rotate(360deg);}}
.shop-popup.shop-theme-xianxia .shop-r5 .shop-deco{color:var(--cinnabar,#c05048);font-family:'Ma Shan Zheng','Kaiti SC','STKaiti','KaiTi','楷体',serif;font-size:15px;text-shadow:0 0 6px rgba(192,80,72,0.5);animation:shop-float 3s ease-in-out infinite;}
@keyframes shop-float{0%,100%{transform:translateY(0) scale(1);}50%{transform:translateY(-2px) scale(1.08);}}
.shop-popup.shop-theme-xianxia .shop-sale{background:linear-gradient(135deg,var(--cinnabar,#c05048),var(--cinnabar-deep,#983028));}
.shop-popup.shop-theme-xianxia .shop-skill-card{color:var(--jade-deep,#5a9078);background:radial-gradient(circle at 50% 38%,rgba(255,240,180,.45),transparent 38%),linear-gradient(145deg,var(--jade-surface-1,#f4faf6),#dcecdc);border-color:var(--gold,#b89848);box-shadow:0 0 0 2px rgba(90,144,120,.25),0 0 18px rgba(184,152,72,.3);}
/* 萦绕极简 */
.shop-popup.shop-theme-minimal{font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','STSong','SimSun','NSimSun',serif;border-radius:2px;}
.shop-popup.shop-theme-minimal .shop-title{font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-style:italic;font-size:18px;letter-spacing:3px;}
.shop-popup.shop-theme-minimal .shop-tab{font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;font-size:11px;}
.shop-popup.shop-theme-minimal .shop-r0{background:var(--card,#fafafa);}
.shop-popup.shop-theme-minimal .shop-r3{border:1.5px solid var(--text,#333);}
.shop-popup.shop-theme-minimal .shop-r5{border:2px solid var(--text,#111);box-shadow:4px 4px 0 var(--text,#111);}
.shop-popup.shop-theme-minimal .shop-r5::after{content:'';position:absolute;inset:-2px;border:1px solid var(--text,#111);pointer-events:none;}
.shop-popup.shop-theme-minimal .shop-deco{font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-weight:700;letter-spacing:1px;font-size:9px;}
.shop-popup.shop-theme-minimal .shop-sale{background:var(--text,#111);}
.shop-popup.shop-theme-minimal .shop-skill-card{color:var(--text,#111);background:linear-gradient(135deg,var(--card,#fff) 0 48%,var(--divider-light,#f1f1f1) 48% 52%,var(--card,#fff) 52%);border:2px solid var(--text,#111);box-shadow:4px 4px 0 var(--text,#111);}
/* 深色：minimal 硬编码 #333/#111 边框/阴影与 #fafafa 白底在深色底近不可见，反转为浅色边/暗底 */
.dark-mode .shop-popup.shop-theme-minimal .shop-r0{background:var(--card,#1a1a1a)}
.dark .shop-popup.shop-theme-minimal .shop-r3,.dark-mode .shop-popup.shop-theme-minimal .shop-r3{border-color:var(--text,#f0f0f0)}
.dark .shop-popup.shop-theme-minimal .shop-r5,.dark-mode .shop-popup.shop-theme-minimal .shop-r5{border-color:var(--text,#f0f0f0);box-shadow:4px 4px 0 var(--text,#f0f0f0)}
.dark .shop-popup.shop-theme-minimal .shop-r5::after,.dark-mode .shop-popup.shop-theme-minimal .shop-r5::after{border-color:var(--text,#f0f0f0)}
/* 深色模式（4 主题走 .dark，minimal 走 .dark-mode，变量自动跟随；特价角标渐变引用主题变量自动跟随） */
/* 深空舰桥：补给与交易终端 */
.shop-popup.shop-theme-bridge.bridge-module-commerce{
  width:min(94%,760px);max-width:760px;max-height:min(82vh,760px);border-radius:0;
  color:var(--bridge-text,var(--text,#16222c));background:var(--bridge-panel,var(--card,#eef3f5));
  border:1px solid var(--bridge-line-strong,var(--accent,#23758a));
  box-shadow:0 0 0 3px var(--bridge-panel,var(--card,#eef3f5)),0 0 0 4px var(--bridge-line,var(--divider,#91a5ad)),0 16px 38px rgba(5,20,27,.24);
  font-family:var(--bridge-font-ui,'Microsoft YaHei','PingFang SC',sans-serif);
}
.shop-popup.shop-theme-bridge .shop-head,.shop-popup.shop-theme-bridge .shop-detail-head{
  background:linear-gradient(90deg,var(--bridge-panel-alt,#dde8eb),var(--bridge-panel,#eef3f5));
  border-bottom:1px solid var(--bridge-line-strong,#23758a);padding:10px 14px;
}
.shop-popup.shop-theme-bridge .shop-title{font-size:14px;letter-spacing:2px;text-transform:uppercase;}
.shop-popup.shop-theme-bridge .shop-title::after{content:'  /  SUPPLY EXCHANGE';font-size:9px;font-weight:500;color:var(--bridge-text-muted,#62757c);letter-spacing:1.4px;}
.shop-popup.shop-theme-bridge .shop-close,.shop-popup.shop-theme-bridge .shop-btn{min-height:34px;border-radius:0;border:1px solid var(--bridge-line-strong,#23758a);}
.shop-popup.shop-theme-bridge .shop-tabs{padding:0 14px;background:var(--bridge-panel-inset,#d5e1e5);border-bottom:1px solid var(--bridge-line,#91a5ad);}
.shop-popup.shop-theme-bridge .shop-tab{border:0;border-right:1px solid var(--bridge-line,#91a5ad);letter-spacing:1px;}
.shop-popup.shop-theme-bridge .shop-tab:first-child{border-left:1px solid var(--bridge-line,#91a5ad);}
.shop-popup.shop-theme-bridge .shop-tab.on{color:var(--bridge-signal,#0a7189);background:var(--bridge-panel,#eef3f5);box-shadow:inset 0 -3px 0 var(--bridge-signal,#0a7189);}
.shop-popup.shop-theme-bridge .shop-bar{background:var(--bridge-panel-inset,#d5e1e5);border-bottom:1px solid var(--bridge-line,#91a5ad);}
.shop-popup.shop-theme-bridge .shop-energy{border-radius:0;background:var(--bridge-screen,#152b32);color:var(--bridge-screen-text,#8eeaff);border:1px solid var(--bridge-line-strong,#23758a);font-family:var(--bridge-font-data,'Consolas',monospace);letter-spacing:1px;}
.shop-popup.shop-theme-bridge .shop-btn{background:transparent;color:inherit;letter-spacing:.5px;}
.shop-popup.shop-theme-bridge .shop-btn:hover,.shop-popup.shop-theme-bridge .shop-btn.primary{background:var(--bridge-signal,#0a7189);border-color:var(--bridge-signal,#0a7189);color:var(--bridge-signal-contrast,#fff);}
.shop-popup.shop-theme-bridge .shop-body{background:linear-gradient(rgba(35,117,138,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(35,117,138,.035) 1px,transparent 1px);background-size:20px 20px;}
.shop-popup.shop-theme-bridge .shop-grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;}
.shop-popup.shop-theme-bridge .shop-card{border-radius:0;border:1px solid var(--bridge-line,#91a5ad);background:var(--bridge-panel,#eef3f5);text-align:left;}
.shop-popup.shop-theme-bridge .shop-card:hover{transform:translateY(-1px);box-shadow:3px 3px 0 var(--bridge-shadow,#799098);}
.shop-popup.shop-theme-bridge .shop-stars,.shop-popup.shop-theme-bridge .shop-quality,.shop-popup.shop-theme-bridge .shop-price,.shop-popup.shop-theme-bridge .shop-deco{font-family:var(--bridge-font-data,'Consolas',monospace);}
.shop-popup.shop-theme-bridge .shop-stars{color:var(--bridge-signal,#0a7189);}
.shop-popup.shop-theme-bridge .shop-r3{border-left:3px solid var(--bridge-signal,#0a7189);}
.shop-popup.shop-theme-bridge .shop-r4{border-left:3px solid var(--bridge-warn,#b47a16);box-shadow:inset 0 0 0 1px rgba(180,122,22,.18);}
.shop-popup.shop-theme-bridge .shop-r5{border:1px solid var(--bridge-warn,#b47a16);box-shadow:inset 0 0 0 3px var(--bridge-panel,#eef3f5),inset 0 0 0 4px var(--bridge-warn,#b47a16);}
.shop-popup.shop-theme-bridge .shop-r5::after{content:'';position:absolute;inset:5px;border:1px solid rgba(180,122,22,.45);pointer-events:none;}
.shop-popup.shop-theme-bridge .shop-sale{border-radius:0;background:var(--bridge-warn,#b47a16);}
.shop-popup.shop-theme-bridge .shop-skill-card{border-radius:0;color:var(--bridge-signal,#0a7189);background:var(--bridge-panel-alt,#dde8eb);border-color:var(--bridge-signal,#0a7189);box-shadow:inset 0 0 0 3px var(--bridge-panel-alt,#dde8eb),inset 0 0 0 4px rgba(10,113,137,.4);}
.shop-popup.shop-theme-bridge .shop-skill-card::before{border-radius:0;}
.shop-popup.shop-theme-bridge .shop-skill-badge,.shop-popup.shop-theme-bridge .shop-skill-sigil{border-radius:0;}
.shop-popup.shop-theme-bridge .shop-empty{border:1px dashed var(--bridge-line,#91a5ad);background:var(--bridge-panel,#eef3f5);}
@media(max-width:599px){
  /* height 用 var(--ub-ol-pad-total)（= applyMobileFixes 写入的 overlay 上下 padding 总额，index.ts）
     抵扣：内联 padding-top:60px 使 100dvh 弹窗底部推出视口，购买按钮不可见 */
  .shop-popup.shop-theme-bridge.bridge-module-commerce:not(.shop-auto-height){width:100%;height:calc(100vh - var(--ub-ol-pad-total,80px));height:calc(100dvh - var(--ub-ol-pad-total,80px));max-width:none;max-height:none;border-left:0;border-right:0;}
  .shop-popup.shop-theme-bridge .shop-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
  .shop-popup.shop-theme-bridge .shop-bar{align-items:flex-start;flex-wrap:wrap;}
  .shop-popup.shop-theme-bridge .shop-actions{width:100%;margin-left:0;display:grid;grid-template-columns:repeat(3,1fr);}
  .shop-popup.shop-theme-bridge .shop-btn{justify-content:center;padding:6px 5px;}
  /* 非 bridge 主题移动端同样升全屏（对齐 bridge，修复 70vh 弹窗商品区不足半屏）；
     排除 shop-auto-height（详情/长按额外提示词弹窗）：全屏只为商品橱窗而生，短内容拉满屏会出大片空白 */
  .shop-popup:not(.shop-theme-bridge):not(.shop-auto-height){width:100%;height:calc(100vh - var(--ub-ol-pad-total,80px));height:calc(100dvh - var(--ub-ol-pad-total,80px));max-width:none;max-height:none;border-left:0;border-right:0;}
  /* 自适应弹窗封顶 = 视口可用高（同上方 var 抵扣），超长描述仍在 .shop-detail-body 内滚动，footer 始终可见 */
  .shop-popup.shop-auto-height{max-height:calc(100vh - var(--ub-ol-pad-total,80px));max-height:calc(100dvh - var(--ub-ol-pad-total,80px));}
}
/* ===== 灵动玻璃（iOS）——系统字体 + 纯色 tint 分级 + hairline 描边，禁渐变 ===== */
.shop-popup.shop-theme-ios{font-family:var(--ios-font,-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei UI',sans-serif);border-radius:20px;}
.shop-popup.shop-theme-ios .shop-title{font-size:17px;font-weight:700;letter-spacing:-.3px;}
.shop-popup.shop-theme-ios .shop-close,.shop-popup.shop-theme-ios .shop-btn{border-radius:999px;border:none;min-height:34px;font-weight:600;transition:transform .15s var(--ios-ease-spring,cubic-bezier(.32,1.18,.35,1)),background .15s;}
.shop-popup.shop-theme-ios .shop-close{background:var(--ios-fill,rgba(120,120,128,.1));color:var(--ios-label-2,rgba(60,60,67,.62));}
.shop-popup.shop-theme-ios .shop-close:hover{background:var(--ios-fill-2,rgba(120,120,128,.16));}
.shop-popup.shop-theme-ios .shop-close:active,.shop-popup.shop-theme-ios .shop-btn:active{transform:scale(.93);}
.shop-popup.shop-theme-ios .shop-tab{border-radius:999px;font-weight:600;letter-spacing:0;}
.shop-popup.shop-theme-ios .shop-tab.on{color:var(--ios-accent,#007aff);background:var(--ios-tint,rgba(0,122,255,.1));}
.shop-popup.shop-theme-ios .shop-card{border-radius:14px;border:1px solid var(--ios-sep,rgba(60,60,67,.12));transition:transform .15s var(--ios-ease-spring,cubic-bezier(.32,1.18,.35,1)),box-shadow .15s;}
.shop-popup.shop-theme-ios .shop-card:hover{transform:scale(1.02);box-shadow:var(--ios-shadow-soft,0 4px 18px rgba(0,0,0,.08));}
.shop-popup.shop-theme-ios .shop-card:active{transform:scale(.97);}
.shop-popup.shop-theme-ios .shop-r2{border-color:rgba(52,199,89,.4);background:rgba(52,199,89,.06);}
.shop-popup.shop-theme-ios .shop-r3{border-color:rgba(0,122,255,.45);background:rgba(0,122,255,.07);}
.shop-popup.shop-theme-ios .shop-r4{border-color:rgba(94,92,230,.5);background:rgba(94,92,230,.08);}
.shop-popup.shop-theme-ios .shop-r5{border:1.5px solid rgba(255,149,0,.6);background:rgba(255,149,0,.09);box-shadow:0 6px 20px rgba(255,149,0,.22);}
.shop-popup.shop-theme-ios .shop-stars{color:var(--ios-accent,#007aff);font-variant-numeric:tabular-nums;letter-spacing:.5px;}
.shop-popup.shop-theme-ios .shop-deco{font-weight:700;letter-spacing:.5px;}
.shop-popup.shop-theme-ios .shop-sale{border-radius:999px;background:var(--ios-accent,#007aff);}
.shop-popup.shop-theme-ios .shop-btn{background:var(--ios-fill,rgba(120,120,128,.1));color:var(--ios-label,#1c1c1e);}
.shop-popup.shop-theme-ios .shop-btn:hover{background:var(--ios-fill-2,rgba(120,120,128,.16));}
.shop-popup.shop-theme-ios .shop-btn.primary{background:var(--ios-accent,#007aff);color:#fff;}
.shop-popup.shop-theme-ios .shop-energy{border-radius:999px;background:var(--ios-fill,rgba(120,120,128,.1));color:var(--ios-label,#1c1c1e);border:1px solid var(--ios-sep,rgba(60,60,67,.12));letter-spacing:0;font-family:var(--ios-font,sans-serif);}
.shop-popup.shop-theme-ios .shop-skill-card{border-radius:14px;color:var(--ios-accent,#007aff);background:var(--ios-tint,rgba(0,122,255,.1));border:1px solid rgba(0,122,255,.35);box-shadow:none;}
.shop-popup.shop-theme-ios .shop-skill-card::before{border-radius:14px;}
.shop-popup.shop-theme-ios .shop-skill-badge{border-radius:999px;}
.shop-popup.shop-theme-ios .shop-empty{border:1.5px dashed var(--ios-sep,rgba(60,60,67,.22));border-radius:14px;}
.dark .shop-popup.shop-theme-ios .shop-card,.dark-mode .shop-popup.shop-theme-ios .shop-card{background:var(--ios-surface-solid,#1c1c1e);border-color:rgba(235,235,245,.12);}
.shop-popup .shop-wardrobe-card{border-color:color-mix(in srgb,var(--accent,#8b678e) 68%,var(--border,#aaa));background:linear-gradient(145deg,var(--card,#fff),color-mix(in srgb,var(--accent,#8b678e) 12%,transparent));}
.shop-popup .shop-wardrobe-badge{display:inline-flex;padding:2px 7px;border-radius:999px;background:var(--accent,#8b678e);color:#fff;font-size:10px;font-weight:700;}
.shop-popup .shop-wardrobe-status{font-size:10px;color:var(--accent,#8b678e);font-weight:700;}
.shop-popup .shop-wardrobe-card.is-owned{opacity:.62;}
.dark .shop-popup,.dark-mode .shop-popup{background:var(--ub-popup-bg,var(--card,#222));color:var(--text,#eee);}
.dark .shop-popup .shop-skill-card,.dark-mode .shop-popup .shop-skill-card{background:linear-gradient(145deg,var(--card,var(--jade-surface-1,#252525)),rgba(128,96,160,.2));color:var(--text,var(--sweet-text,#eee));box-shadow:0 0 0 2px rgba(255,255,255,.12),0 8px 20px rgba(0,0,0,.4);}
`;

function injectCss(): void {
  // U28(第十二轮)：改走幂等口——原实现只认模块布尔，模块重求值（双实例/重注入）会再插一份同名样式表
  ensureStyleOnce('ub-shop-css', SHOP_CSS + THEME_SCOPED_CSS);
}

/** 5 主题 × 6 档星等 + 史诗/传说/神话装饰符（spec §6.2 表） */
const STARS: Record<StyleType, string[]> = {
  ancient:     ['●○○○○○','●●○○○○','●●●○○○','●●●●○○','●●●●●○','●●●●●●'],
  flirtatious: ['✦✧✧✧✧✧','✦✦✧✧✧✧','✦✦✦✧✧✧','✦✦✦✦✧✧','✦✦✦✦✦✧','✦✦✦✦✦✦'],
  sweet:       ['★☆☆☆☆☆','★★☆☆☆☆','★★★☆☆☆','★★★★☆☆','★★★★★☆','★★★★★★'],
  xianxia:     ['◆◇◇◇◇◇','◆◆◇◇◇◇','◆◆◆◇◇◇','◆◆◆◆◇◇','◆◆◆◆◆◇','◆◆◆◆◆◆'],
  minimal:     ['01/06','02/06','03/06','04/06','05/06','06/06'],
  bridge:      ['01/06','02/06','03/06','04/06','05/06','06/06'],
  ios:         ['1/6','2/6','3/6','4/6','5/6','6/6'],
};
const DECO: Record<StyleType, [string, string, string]> = {  // [史诗, 传说, 神话]
  ancient:     ['珍', '瑰', '絕'],
  flirtatious: ['💎', '👑', '💗'],
  sweet:       ['🌸', '🎀', '💖'],
  xianxia:     ['灵', '寶', '聖'],
  minimal:     ['EPIC', 'LEG', 'MYTH'],
  bridge:      ['R4', 'R5', 'R6'],
  ios:         ['稀有', '传说', '神话'],
};

function shopPopupClass(style: StyleType): string {
  return 'shop-popup shop-theme-' + style
    + (style === 'bridge' ? ' bridge-window bridge-module-commerce' : '');
}

// U18-2：「是否已掌握某技能」判定收成一处——复用 core/shop-story-ai#findOwnedSkill
// （此前本文件另写一份同逻辑的 isOwnedSkillName，与 shop-regular/shop-story-ai 的判定口径可能漂移）。
function isOwnedSkillName(skillName: string): boolean {
  return findOwnedSkill(skillName) !== null;
}

/** 技能卡/详情共用的结构化数据（剧情特卖技能书 与 常规售卖通用技能书 统一走此渲染）。 */
interface SkillCardData {
  id: string;
  name: string;
  skillType: string;
  strength: string;
  price: number;
  desc: string;
}

interface WardrobeCardData {
  id: string;
  name: string;
  category: WardrobeCategory;
  price: number;
  desc: string;
}

function asWardrobeCardData(item: ShopRegularItem | ShopStoryItem): WardrobeCardData | null {
  if (!('kind' in item) || item.kind !== 'wardrobe' || !(item as any).category) return null;
  return {
    id: item.id,
    name: item.name,
    category: (item as any).category,
    price: item.price,
    desc: (item as any).desc || '',
  };
}

function isOwnedWardrobeProduct(item: WardrobeCardData): boolean {
  if (!getConfig().wardrobeEnabled) return false;
  try {
    const key = wardrobeDedupeKey(item.name, item.category);
    return getWardrobeSnapshot().items.some(candidate =>
      wardrobeDedupeKey(candidate.name, candidate.category) === key);
  } catch (_e) {
    return false;
  }
}

function buildWardrobeCardHTML(item: WardrobeCardData, style: StyleType, idPrefix: 'story-' | 'reg-'): string {
  const enabled = getConfig().wardrobeEnabled;
  const owned = enabled && isOwnedWardrobeProduct(item);
  const status = !enabled ? '需开启衣柜' : owned ? '已拥有' : item.category;
  return '<div class="shop-card shop-wardrobe-card' + (owned ? ' is-owned' : '') + '" data-shop-item="' + escapeHtml(idPrefix + item.id) + '">'
    + '<span class="shop-wardrobe-badge">衣柜</span>'
    + '<div class="shop-name">' + escapeHtml(item.name) + '</div>'
    + '<div class="shop-wardrobe-status">' + escapeHtml(status) + '</div>'
    + '<div class="shop-price"><span>' + THEME_TEXT[style].energyIcon + item.price + '</span></div>'
    + '</div>';
}

/** 常规售卖/剧情特卖任一来源中，kind==='skill' 的条目 → SkillCardData；否则 null。 */
function asSkillCardData(item: ShopRegularItem | ShopStoryItem): SkillCardData | null {
  if (!('kind' in item) || item.kind !== 'skill') return null;
  return {
    id: item.id,
    name: item.name,
    skillType: String((item as any).skillType ?? ''),
    strength: String((item as any).strength ?? ''),
    price: item.price,
    desc: (item as any).desc ?? '',
  };
}

function buildSkillCardHTML(item: SkillCardData, style: StyleType, idPrefix: 'story-' | 'reg-'): string {
  const skillEnabled = getConfig().skillEnabled;
  const owned = skillEnabled && isOwnedSkillName(item.name);
  const id = escapeHtml(idPrefix + item.id);
  const status = !skillEnabled ? '<div class="shop-skill-status">需开启技能</div>'
    : owned ? '<div class="shop-skill-status">已掌握 · 购买转经验</div>' : '';
  return '<div class="shop-card shop-skill-card' + (skillEnabled ? '' : ' is-skill-disabled') + '" data-shop-item="' + id + '">'
    + '<span class="shop-skill-badge">技能</span>'
    + '<div class="shop-skill-sigil" aria-hidden="true">✦</div>'
    + '<div class="shop-skill-meta">' + escapeHtml(item.skillType) + ' · ' + escapeHtml(item.strength) + '</div>'
    + '<div class="shop-name">' + escapeHtml(item.name) + '</div>'
    + status
    + '<div class="shop-price"><span>' + THEME_TEXT[style].energyIcon + item.price + '</span></div>'
    + '</div>';
}

/** 构造单张卡片 HTML */
function buildCardHTML(item: ShopRegularItem | ShopStoryItem, isStory: boolean, style: StyleType): string {
  const wardrobeData = asWardrobeCardData(item);
  if (wardrobeData) return buildWardrobeCardHTML(wardrobeData, style, isStory ? 'story-' : 'reg-');
  const skillData = asSkillCardData(item);
  if (skillData) return buildSkillCardHTML(skillData, style, isStory ? 'story-' : 'reg-');
  const rank = isStory ? (item.price >= 15 ? 5 : item.price >= 12 ? 4 : item.price >= 9 ? 3 : item.price >= 6 ? 2 : 1)
                       : Math.max(0, qualityToRank((item as ShopRegularItem).quality));
  const qName = QUALITY_NAMES[style][rank] || '';
  const stars = STARS[style][rank] || '';
  let deco = '';
  if (rank === 3) deco = '<span class="shop-deco">' + DECO[style][0] + '</span>';
  else if (rank === 4) deco = '<span class="shop-deco">' + DECO[style][1] + '</span>';
  else if (rank === 5) deco = '<span class="shop-deco">' + DECO[style][2] + '</span>';
  // 特价角标（仅常规售卖且有 discount）
  let sale = '';
  let priceHTML = '';
  if (!isStory && (item as ShopRegularItem).discount) {
    const r = item as ShopRegularItem;
    sale = '<span class="shop-sale">-' + r.discount + '%</span>';
    priceHTML = '<span class="shop-price-strike">' + (r.originalPrice) + '</span><span>' + THEME_TEXT[style].energyIcon + r.price + '</span>';
  } else {
    priceHTML = '<span>' + THEME_TEXT[style].energyIcon + item.price + '</span>';
  }
  const id = escapeHtml(isStory ? 'story-' + item.id : 'reg-' + item.id);
  return '<div class="shop-card shop-r' + rank + '" data-shop-item="' + id + '">'
    + deco + sale
    + '<div class="shop-stars">' + stars + '</div>'
    + '<div class="shop-quality">' + qName + '</div>'
    + '<div class="shop-name">' + escapeHtml(item.name) + '</div>'
    + '<div class="shop-price">' + priceHTML + '</div>'
    + '</div>';
}

function buildSkillDetailHTML(item: SkillCardData, style: StyleType): string {
  const T = THEME_TEXT[style];
  const skillEnabled = getConfig().skillEnabled;
  const owned = skillEnabled && isOwnedSkillName(item.name);
  const ownedHint = owned
    ? '<div class="shop-skill-owned">已掌握，购买后转化为经验 +100</div>'
    : '';
  const disabled = skillEnabled ? '' : ' disabled';
  const buttonText = skillEnabled ? '习得技能' : '请先开启技能';
  return '<div class="' + shopPopupClass(style) + ' shop-auto-height">'
    + '<div class="shop-detail-head"><span class="shop-detail-back" id="shopDetailBack">← ' + escapeHtml(item.name) + '</span><button class="shop-close" id="panelClose">×</button></div>'
    + '<div class="shop-detail-body">'
    + '<div class="shop-detail-banner shop-skill-detail-banner shop-skill-card">'
    + '<span class="shop-skill-badge">技能</span>'
    + '<div class="shop-skill-sigil" aria-hidden="true">✦</div>'
    + '<div class="shop-detail-name">' + escapeHtml(item.name) + '</div>'
    + '<div class="shop-skill-meta">' + escapeHtml(item.skillType) + ' · ' + escapeHtml(item.strength) + '</div>'
    + '</div>'
    + '<div class="shop-skill-effect"><div class="shop-skill-effect-title">基础效果</div>' + escapeHtml(item.desc) + '</div>'
    + '<div class="shop-skill-note">购买后直接写入技能表，不自动生成天赋树。' + ownedHint + '</div>'
    + '</div>'
    + '<div class="shop-detail-footer"><div><span style="font-size:22px;font-weight:700">' + T.energyIcon + item.price + '</span></div>'
    + '<button class="shop-btn primary" id="shopDetailBuy" style="padding:10px 24px;font-size:14px"' + disabled + '>' + buttonText + '</button></div>'
    + '</div>';
}

function buildWardrobeDetailHTML(item: WardrobeCardData, style: StyleType): string {
  const T = THEME_TEXT[style];
  const enabled = getConfig().wardrobeEnabled;
  const owned = enabled && isOwnedWardrobeProduct(item);
  const disabled = enabled && !owned ? '' : ' disabled';
  const buttonText = !enabled ? '请先开启衣柜' : owned ? '已拥有' : '加入衣柜';
  return '<div class="' + shopPopupClass(style) + ' shop-auto-height">'
    + '<div class="shop-detail-head"><span class="shop-detail-back" id="shopDetailBack">← ' + escapeHtml(item.name) + '</span><button class="shop-close" id="panelClose">×</button></div>'
    + '<div class="shop-detail-body">'
    + '<div class="shop-detail-banner shop-wardrobe-card">'
    + '<span class="shop-wardrobe-badge">衣柜 · ' + escapeHtml(item.category) + '</span>'
    + '<div class="shop-detail-name">' + escapeHtml(item.name) + '</div>'
    + '</div>'
    + '<div class="shop-detail-desc">' + escapeHtml(item.desc) + '</div>'
    + '<div class="shop-skill-note">购买后直接加入当前聊天的衣柜，不写入物品表。</div>'
    + '</div>'
    + '<div class="shop-detail-footer"><div><span style="font-size:22px;font-weight:700">' + T.energyIcon + item.price + '</span></div>'
    + '<button class="shop-btn primary" id="shopDetailBuy" style="padding:10px 24px;font-size:14px"' + disabled + '>' + buttonText + '</button></div>'
    + '</div>';
}

/** 构造详情卡 HTML */
function buildDetailHTML(item: ShopRegularItem | ShopStoryItem, isStory: boolean, style: StyleType): string {
  const wardrobeData = asWardrobeCardData(item);
  if (wardrobeData) return buildWardrobeDetailHTML(wardrobeData, style);
  const skillData = asSkillCardData(item);
  if (skillData) return buildSkillDetailHTML(skillData, style);
  const rank = isStory ? (item.price >= 15 ? 5 : item.price >= 12 ? 4 : item.price >= 9 ? 3 : item.price >= 6 ? 2 : 1)
                       : Math.max(0, qualityToRank((item as ShopRegularItem).quality));
  const qName = QUALITY_NAMES[style][rank] || '';
  const stars = STARS[style][rank] || '';
  let deco = '';
  if (rank >= 3) deco = '<span class="shop-deco" style="font-size:24px">' + DECO[style][rank - 3] + '</span>';
  const T = THEME_TEXT[style];
  const desc = escapeHtml((item as any).desc || (item as any).description || '');
  let priceBlock = '';
  if (!isStory && (item as ShopRegularItem).discount) {
    const r = item as ShopRegularItem;
    priceBlock = '<span style="text-decoration:line-through;opacity:.5;font-size:var(--ub-ui-font-14,14px);font-weight:400">' + T.energyIcon + r.originalPrice + '</span>'
      + '<span style="font-size:22px;font-weight:700">' + T.energyIcon + r.price + '</span>'
      + '<span style="font-size:var(--ub-ui-font-11,11px);background:var(--accent,#888);color:#fff;padding:2px 6px;border-radius:3px;font-weight:700">-' + r.discount + '%</span>';
  } else {
    priceBlock = '<span style="font-size:22px;font-weight:700">' + T.energyIcon + item.price + '</span>';
  }
  return '<div class="' + shopPopupClass(style) + ' shop-auto-height">'
    + '<div class="shop-detail-head"><span class="shop-detail-back" id="shopDetailBack">← ' + escapeHtml(item.name) + '</span><button class="shop-close" id="panelClose">×</button></div>'
    + '<div class="shop-detail-body">'
    + '<div class="shop-detail-banner shop-r' + rank + '">' + deco
    + '<div style="font-size:var(--ub-ui-font-11,11px);letter-spacing:2px;opacity:.7;margin-bottom:4px">' + qName + '</div>'
    + '<div style="font-size:var(--ub-ui-font-14,14px);letter-spacing:2px;margin-bottom:8px">' + stars + '</div>'
    + '<div class="shop-detail-name">' + escapeHtml(item.name) + '</div>'
    + '<div style="font-size:var(--ub-ui-font-11,11px);opacity:.7">类型：' + escapeHtml(item.type || '道具') + '</div>'
    + '</div>'
    + '<div class="shop-detail-desc">' + desc + '</div>'
    + '</div>'
    + '<div class="shop-detail-footer"><div>' + priceBlock + '</div>'
    + '<button class="shop-btn primary" id="shopDetailBuy" style="padding:10px 24px;font-size:14px">' + T.buy + '</button></div>'
    + '</div>';
}

/** 构造主弹窗 HTML */
function buildShopHTML(style: StyleType, regular: ShopRegularItem[], story: ShopStoryItem[], energy: number): string {
  const T = THEME_TEXT[style];
  const tab = _currentTab;
  const items = tab === 'regular' ? regular : story;
  const isStory = tab === 'story';
  let body = '';
  if (items.length === 0) {
    body = '<div class="shop-empty"><div class="icon">' + (isStory ? '✨' : '📭') + '</div>'
      + '<div>' + (isStory ? '剧情特卖橱窗为空' : '本期已售罄') + '</div>'
      + '<div style="font-size:var(--ub-ui-font-11,11px);opacity:.7;margin-top:6px">' + (isStory ? '点击刷新让 AI 为当前剧情定制道具' : '请重置或等待日期变更后刷新') + '</div></div>';
  } else {
    body = '<div class="shop-grid">' + items.map(it => buildCardHTML(it, isStory, style)).join('') + '</div>';
  }
  return '<div class="' + shopPopupClass(style) + '">'
    + '<div class="shop-head"><div class="shop-title">' + T.title + '</div><button class="shop-close" id="panelClose">×</button></div>'
    + '<div class="shop-tabs">'
    + '<div class="shop-tab' + (tab === 'regular' ? ' on' : '') + '" data-shop-tab="regular">' + T.tabRegular + '<span class="shop-tab-count">(' + regular.length + ')</span></div>'
    + '<div class="shop-tab' + (tab === 'story' ? ' on' : '') + '" data-shop-tab="story">' + T.tabStory + '<span class="shop-tab-count">(' + story.length + ')</span></div>'
    + '</div>'
    + '<div class="shop-bar"><div class="shop-energy">' + T.energyIcon + '<span>' + energy + '</span></div>'
    + '<div class="shop-actions">'
    + '<button class="shop-btn ub-lp-hint" data-shop-action="refresh" title="剧情特卖页：短按普通刷新；长按可附加定制要求">' + T.refresh + '<span class="cost">-' + SHOP_REFRESH_COST + '</span></button>'
    + '<button class="shop-btn" data-shop-action="draw">' + T.draw + '<span class="cost">-' + GACHA_COST + '</span></button>'
    + '<button class="shop-btn primary" data-shop-action="draw10">' + T.draw10 + '<span class="cost">-' + GACHA10_COST + '</span></button>'
    + '</div></div>'
    + '<div class="shop-body">' + body + '</div>'
    + '</div>';
}

let _lastScrollTop = 0;
// 各 tab 离开时的橱窗滚动位置（tab 切换互不丢位置；详情返回仍走 _lastScrollTop）
const _tabScrollTops: Record<'regular' | 'story', number> = { regular: 0, story: 0 };

// U10：剧情特卖刷新按钮的长按计时/合成 click 吞噬统一交给 renderers/long-press，本文件不再自持状态。

/** 渲染主弹窗（全量重建；详情返回时 restoreScroll=true 恢复进入详情前的滚动位置） */
async function renderShop(overlay: HTMLElement, style: StyleType, restoreScroll: boolean = false): Promise<void> {
  const energy = readSerseEnergy() // U31：统一出口（纯展示读）;
  const regular = getRegularItems();
  const story = getStoryItems();
  const isMinimal = style === 'minimal';
  if (isMinimal) syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  overlay.innerHTML = buildShopHTML(style, regular, story, energy);
  overlay.classList.add('show');
  if (restoreScroll) {
    const bodyEl = overlay.querySelector('.shop-body');
    if (bodyEl) (bodyEl as HTMLElement).scrollTop = _lastScrollTop;
  }
  bindShopEvents(overlay, style);
}

/** 局部更新橱窗主体（不重建 head/tabs/bar，避免闪烁 + 按 keepScroll 决定是否保留滚动） */
async function updateShopBody(overlay: HTMLElement, style: StyleType, keepScroll: boolean): Promise<void> {
  const energy = readSerseEnergy() // U31：统一出口（纯展示读）;
  const regular = getRegularItems();
  const story = getStoryItems();
  // 更新能量数字
  const energySpan = overlay.querySelector('.shop-energy span');
  if (energySpan) energySpan.textContent = String(energy);
  // 更新 tab 高亮 + 计数
  const tabs = overlay.querySelectorAll('.shop-tab');
  tabs.forEach(t => {
    const tabName = t.getAttribute('data-shop-tab');
    t.classList.toggle('on', tabName === _currentTab);
    const count = t.querySelector('.shop-tab-count');
    if (count) count.textContent = '(' + (tabName === 'regular' ? regular.length : story.length) + ')';
  });
  // 更新 body
  const bodyEl = overlay.querySelector('.shop-body') as HTMLElement | null;
  if (!bodyEl) return;
  const savedScroll = keepScroll ? bodyEl.scrollTop : 0;
  const items = _currentTab === 'regular' ? regular : story;
  const isStory = _currentTab === 'story';
  let body: string;
  if (items.length === 0) {
    body = '<div class="shop-empty"><div class="icon">' + (isStory ? '✨' : '📭') + '</div>'
      + '<div>' + (isStory ? '剧情特卖橱窗为空' : '本期已售罄') + '</div>'
      + '<div style="font-size:var(--ub-ui-font-11,11px);opacity:.7;margin-top:6px">' + (isStory ? '点击刷新让 AI 为当前剧情定制道具' : '请重置或等待日期变更后刷新') + '</div></div>';
  } else {
    body = '<div class="shop-grid">' + items.map(it => buildCardHTML(it, isStory, style)).join('') + '</div>';
  }
  bodyEl.innerHTML = body;
  bodyEl.scrollTop = savedScroll;
}

/** 绑定事件（单一委托） */
function bindShopEvents(overlay: HTMLElement, style: StyleType): void {
  overlay.onclick = async function (e) {
    const target = e.target as HTMLElement;
    if (e.target === overlay || target.id === 'panelClose') {
      if (guardGhostClick()) return;
      closePanelOverlay(overlay);
      _onCloseRender?.();
      return;
    }
    // Tab 切换（局部更新；记住离开侧滚动位置，恢复目标侧记忆位置，无记忆=回到顶部）
    const tabEl = target.closest('[data-shop-tab]') as HTMLElement;
    if (tabEl) {
      const newTab = tabEl.dataset.shopTab as 'regular' | 'story';
      if (newTab !== _currentTab) {
        const fromBody = overlay.querySelector('.shop-body') as HTMLElement | null;
        if (fromBody) _tabScrollTops[_currentTab] = fromBody.scrollTop;
        _currentTab = newTab;
        await updateShopBody(overlay, style, false);
        const toBody = overlay.querySelector('.shop-body') as HTMLElement | null;
        if (toBody) toBody.scrollTop = _tabScrollTops[newTab] || 0;
      }
      return;
    }
    // 动作按钮（局部更新，保留滚动）
    const actEl = target.closest('[data-shop-action]') as HTMLElement;
    if (actEl) {
      const action = actEl.dataset.shopAction;
      if (action === 'refresh') {
        // 长按已由 long-press 模块处理（弹了额外提示词框并吞掉合成 click），此处只走短按
        if (_currentTab === 'regular') { await manualRefreshRegular(); }
        else { await performStorySaleGeneration(actEl as HTMLButtonElement); }
        await updateShopBody(overlay, style, true);
      } else if (action === 'draw') {
        await performGachaDraw(style, () => updateShopBody(overlay, style, true), confirmMessage);
        await updateShopBody(overlay, style, true);
      } else if (action === 'draw10') {
        await performGachaDraw10(style, () => updateShopBody(overlay, style, true), confirmMessage);
        await updateShopBody(overlay, style, true);
      }
      return;
    }
    // 卡片点击 → 详情
    const cardEl = target.closest('[data-shop-item]') as HTMLElement;
    if (cardEl) {
      const id = cardEl.dataset.shopItem || '';
      showDetail(overlay, style, id);
    }
  };

  // 剧情特卖刷新按钮长按（U10：统一走 long-press）：仅 story Tab 可用，长按弹额外提示词框、扣 5 能量。
  // 短按放行上面的委托 onclick 走普通刷新。
  const refreshBtn = overlay.querySelector<HTMLButtonElement>('[data-shop-action="refresh"]');
  if (refreshBtn) {
    bindLongPress(refreshBtn, {
      canStart: () => _currentTab === 'story',
      onLong: () => { void showStorySaleExtraPromptDialog(overlay, style); },
    });
  }
}

/**
 * 剧情特卖长按弹框：输入额外提示词后发起 5 能量生成（仅本次生效，不持久化）。
 * 取消或确认后恢复商店主弹窗。UI 类复用 .shop-* 主题样式。
 */
async function showStorySaleExtraPromptDialog(overlay: HTMLElement, style: StyleType): Promise<void> {
  const T = THEME_TEXT[style];
  const dialogClass = shopPopupClass(style) + ' shop-extra-popup shop-auto-height';
  const html = '<div class="' + dialogClass + '">'
    + '<div class="shop-head"><div class="shop-title">额外生成要求 — ' + T.tabStory + '</div><button class="shop-close" id="shopExtraClose">×</button></div>'
    + '<div class="shop-extra-wrap">'
    + '<div class="shop-extra-label">补充本次剧情特卖的额外要求（仅本次生效，不保存）。长按刷新消耗 <b>' + SHOP_REFRESH_LONG_PRESS_COST + '</b> 点瑟瑟能量。</div>'
    + '<textarea class="shop-extra-textarea" id="shopExtraInput" rows="5" placeholder="例如：&#10;· 侧重与某角色的羁绊道具&#10;· 加入契合当前场景的奇物&#10;· 指定某种风格或价位分布"></textarea>'
    + '</div>'
    + '<div class="shop-extra-btns">'
    + '<button class="shop-btn" id="shopExtraCancel">取消</button>'
    + '<button class="shop-btn primary" id="shopExtraOk" disabled>开始生成</button>'
    + '</div>'
    + '</div>';
  overlay.innerHTML = html;
  if (style === 'minimal') syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  markPopupShown();
  overlay.classList.add('show');

  const input = overlay.querySelector<HTMLTextAreaElement>('#shopExtraInput');
  const okBtn = overlay.querySelector<HTMLButtonElement>('#shopExtraOk');
  const updateOk = (): void => { if (okBtn) okBtn.disabled = !((input?.value || '').trim()); };
  if (input) input.addEventListener('input', updateOk);
  const cachedShop = readExtraPromptCache(EXTRA_PROMPT_CACHE_KEYS.shopStory);
  if (input && cachedShop) { input.value = cachedShop; updateOk(); }
  setTimeout(() => input?.focus(), 50);

  // 恢复商店主弹窗
  const restoreShop = async (): Promise<void> => { await renderShop(overlay, style, true); };

  // 长按触发时手指仍按下，松手补发的合成 click 会落在刚替换出的弹窗上；在 document capture 层一次性吞掉
  // （U10：统一由 long-press 模块提供；guardGhostClick 只覆盖弹窗出现后 300ms，此处按「指针是否仍按下」判定更准）。
  swallowGhostClickIfPointerActive();

  overlay.onclick = async function (e) {
    const target = e.target as HTMLElement;
    if (e.target === overlay || target.closest('#shopExtraClose') || target.closest('#shopExtraCancel')) {
      if (guardGhostClick()) return;
      await restoreShop();
      return;
    }
    if (target.closest('#shopExtraOk')) {
      if (guardGhostClick()) return;
      const val = (input?.value || '').trim();
      if (!val) return;
      writeExtraPromptCache(EXTRA_PROMPT_CACHE_KEYS.shopStory, val);
      await restoreShop();
      const refreshBtn = overlay.querySelector<HTMLButtonElement>('[data-shop-action="refresh"]');
      await performStorySaleGeneration(refreshBtn || undefined, val, SHOP_REFRESH_LONG_PRESS_COST);
      await updateShopBody(overlay, style, true);
    }
  };
}

/** 显示详情卡 */
function showDetail(overlay: HTMLElement, style: StyleType, rawId: string): void {
  const isStory = rawId.startsWith('story-');
  const id = rawId.replace(/^(story-|reg-)/, '');
  const items = isStory ? getStoryItems() : getRegularItems();
  const item = items.find(it => it.id === id);
  if (!item) return;
  // 进入详情前记录橱窗滚动位置，返回时恢复
  const bodyEl = overlay.querySelector('.shop-body');
  if (bodyEl) _lastScrollTop = (bodyEl as HTMLElement).scrollTop;
  const isMinimal = style === 'minimal';
  if (isMinimal) syncDarkClassMinimal(overlay); else syncDarkClass(overlay);
  overlay.innerHTML = buildDetailHTML(item, isStory, style);
  overlay.onclick = async function (e) {
    const target = e.target as HTMLElement;
    if (e.target === overlay || target.id === 'panelClose') {
      if (guardGhostClick()) return;
      await renderShop(overlay, style, true);
      return;
    }
    if (target.id === 'shopDetailBack' || target.closest('#shopDetailBack')) {
      await renderShop(overlay, style, true);
      return;
    }
    if (target.id === 'shopDetailBuy' || target.closest('#shopDetailBuy')) {
      let ok: boolean;
      if (isStory) {
        ok = await buyStoryItem(id, confirmMessage);
      } else {
        // 常规售卖：技能书写技能表；衣柜商品直入衣柜；其余入物品表。
        const regItem = getRegularItems().find(it => it.id === id);
        ok = regItem?.kind === 'skill'
          ? await buyRegularSkillItem(id, confirmMessage)
          : regItem?.kind === 'wardrobe'
            ? await buyRegularWardrobeItem(id)
            : await buyRegularItem(id);
      }
      if (ok) await renderShop(overlay, style, true);
    }
  };
}

/** 入口：显示商店弹窗 */
export async function showShopPopup(style: StyleType, onCloseRender?: () => void): Promise<void> {
  injectCss();
  _onCloseRender = onCloseRender || null;
  const overlay = document.getElementById('panelOverlay')!;
  // 加载数据：常规售卖 ensure（自动刷新过期）+ 剧情特卖读世界书
  await ensureRegularShop();
  const data = await loadShopData();
  setStoryItems(data.storySpecials);
  markPopupShown();
  await renderShop(overlay, style);
  // 首次打开播放入场动画（后续重渲染不重播，避免闪烁）
  const popup = overlay.querySelector('.shop-popup');
  if (popup) {
    popup.classList.add('shop-entering');
    setTimeout(() => popup.classList.remove('shop-entering'), 260);
  }
}
