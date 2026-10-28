// ===== 地图生成 AI 提示词 =====
//
// 统一为单次 AI 调用，同时输出三段：
//   <MAP_JSON> 结构数据（rooms/doors/exits/characters）
//   <MAP_SVG>  精美渲染（AI 直接绘制，含丰富装饰细节，前端叠加角色标记）
//   <MAP_DESC> 探索介绍（summary/items/directions/exploreSummary/exploreNote）

import type { MapStyle } from './constants';

// ─────────────────────────────────────────────────────────────
// 地图尺寸计算（按子节点数量阶梯扩大）
// ─────────────────────────────────────────────────────────────
export function computeMapSize(childCount: number): { width: number; height: number } {
  if (childCount <= 5) return { width: 800, height: 600 };
  if (childCount <= 10) return { width: 1000, height: 750 };
  return { width: 1200, height: 900 };
}

// ─────────────────────────────────────────────────────────────
// AI 输出 JSON Schema 描述
// ─────────────────────────────────────────────────────────────
export function getMapJsonSchemaDesc(
  mapSize: { width: number; height: number },
  includeCharacters = true,
): string {
  const characterBlock = includeCharacters ? `,
  "characters": [
    { "name":"角色名","role":"protagonist|ally|npc|enemy|item","roomId":"r1","x":120,"y":100,"detail":"身份简述和当前行为" }
  ]` : '';
  const characterRule = includeCharacters
    ? `- characters：只能根据上方「当前即时人物」定位人物；roomId 锚定所在房间，detail 填当前行为。主角默认放在主要房间中心；所有坐标在 0-${mapSize.width} × 0-${mapSize.height} 范围内。`
    : '- 地图库编辑任务不需要人物信息，不要输出 characters 字段。';
  return `JSON 对象结构如下（坐标系 0..${mapSize.width} × 0..${mapSize.height}）：
{
  "title": "地图标题（即地点名）",
  "mapSize": { "width": ${mapSize.width}, "height": ${mapSize.height} },
  "rooms": [
    { "id":"r1","name":"客厅","x":50,"y":50,"width":200,"height":150,
      "type":"room|corridor|landmark","color":"#可选十六进制色或空串" }
  ],
  "doors": [ { "from":"r1","to":"r2","x":250,"y":120 } ],
  "exits": [
    { "id":"e1","label":"返回上一级","targetName":"上级地点短名","kind":"parent","x":400,"y":0 },
    { "id":"e2","label":"去厨房","targetName":"厨房","kind":"child","x":400,"y":600 },
    { "id":"e3","label":"去卧室","targetName":"卧室","kind":"sibling","x":600,"y":300 }
  ]${characterBlock}
}
要求：
- rooms：房间/区域紧挨排列，坐标边缘贴合形成连通整体；corridor 用细长矩形表示走廊本身即区域；布局可不规则。
- exits：可点击的出口热点。kind=parent 指向上一级地点；kind=child 指向下一级地点；kind=sibling 指向同级地点。x/y 根据场景逻辑放置。
${characterRule}`;
}

// ─────────────────────────────────────────────────────────────
// SVG 绘制要求（注入到所有提示词）
// ─────────────────────────────────────────────────────────────
function getSvgDetailRequirements(mapSize: { width: number; height: number }): string {
  return `SVG 精美绘制要求：

【场景理解——绘制前必须充分阅读】
- 仔细阅读上方「剧情上下文」中的聊天历史，理解当前正在发生的场景、人物活动、环境氛围
- 仔细阅读上方「地点相关条目库」中的世界书条目，提取场景的具体描述（建筑风格、陈设布局、环境特征等）
- 根据上述信息判断：这是古代还是现代？是室内还是户外？是居所、市集、山林还是其他？据此选择匹配的装饰风格
- 场景中的具体物件应尽量呼应剧情中提及的元素（如剧情提到"茶桌上的青瓷盏"，SVG 中就应画出茶桌与青瓷盏的轮廓）

【绘制规范】
- 整体低饱和度配色，淡雅不干扰地图阅读（淡灰、淡蓝、淡米色等），不要使用羊皮纸颜色
- 墙壁、边界线条做圆角处理，配合场景风格选用描边色，禁止生硬黑色粗线
- 房间地面用细微线性渐变区分功能区（如卧室淡暖色、书房淡冷色、厨房淡黄等），禁止纯色平涂，保持柔和
- 用 <g> 分层组织：底层地形底色 → 区域分区 → 建筑地标 → 装饰物 → 文字标注
- JSON 的 rooms/doors 仅作结构框架参考，SVG 绘制时可在此基础上自行丰富细节（如添加 JSON 未列出的家具、纹理、装饰物件）

【装饰细节要求】（这是提升精致度的关键，请务必充分刻画）
- 居所场景：床、桌椅、屏风、书架、衣柜、茶几、烛台、盆栽、窗帘等家具
- 院落/户外：树木、花丛、石径、池塘、假山、篱笆、石灯、井等景观
- 市集/街巷：摊位、旗帜、灯笼、招牌、货箱、石板路等街景元素
- 室内细节：地毯、挂画、花瓶、香炉、灯具、帘幕等陈设
- 自然元素：草地纹理、水面波纹、树冠轮廓、云朵、远山等环境渲染
- 根据房间功能添加对应家具/物件，让每个空间都有辨识度和生活气息
- 装饰物用 path 绘制柔和轮廓并加轻微投影增加层次，地面/墙面可用低透明度纹理营造材质感（木地板纹、石板纹、草地等）

【技术约束】
- 装饰细节不要遮挡房间标签文字，保持地图可读性
- 所有渐变、滤镜、纹理模板在 <defs> 内集中定义；可对区域轮廓应用轻微 feDropShadow 增加立体感，但文字禁止应用滤镜
- path 路径平滑、转角圆角，避免纯直线硬折角
- 文字使用无衬线圆润字体并加轻微阴影防遮挡，重要地标字号放大、次要地名缩小
- 禁用简陋元素：禁止仅用基础直线、矩形、圆点拼凑；禁止粗细一致的黑色轮廓；禁止文字堆叠重叠
- **坐标系必须与 JSON 完全一致**（0-${mapSize.width} × 0-${mapSize.height}），房间/门坐标照搬 JSON 的 x/y/width/height
- **不要在 SVG 中绘制任何人物或角色标记**，只绘制地形、房间、门和装饰物，角色标记由前端叠加
- **不要绘制出口方向导航标注**：出口（如"去厨房""返回上一级""→卧室"等方向箭头与说明文字）由前端依据 JSON exits 自动叠加为可点击热点；SVG 中重复绘制会与前端标签重叠显示成两份，故禁止绘制出口/方向导航文字与箭头。房间内部的名称标签照常绘制，不受影响。
- **禁止使用 <g transform="translate(...)"> 包裹房间矩形**，所有房间矩形必须用绝对坐标直接绘制
- **viewBox 必须为 "0 0 ${mapSize.width} ${mapSize.height}"**，缺失或不符则补正
- **房间矩形 x/y/width/height 必须与 JSON rooms 完全一致**（容差 0px），不可漂移`;
}

// ─────────────────────────────────────────────────────────────
// MAP_DESC Schema 描述（新增）
// ─────────────────────────────────────────────────────────────
export const MAP_DESC_SCHEMA_DESC = `<MAP_DESC> 标签内输出一个 JSON 对象，结构如下：
{
  "summary": "地点简要介绍（建筑风格/布局/氛围/特征），50-150 字",
  "items": ["青瓷茶盏", "红木圆桌", "屏风", ...]（各项合并总长不超过 80 字）,
  "directions": "东侧通向厨房，南侧为出口返回上一级，西侧卧室..."（不超过 80 字）,
  "exploreSummary": "探索情况总结：把【现有探索概况】与【待压缩的旧探索记录】合并压缩成不超过 200 字的连续总结；没有待压缩记录时原样沿用现有概况（没有则空串）",
  "exploreNote": "本次探索一句话纪要，如'初次到访，与XX在客厅交谈'"
}
要求：
- summary：客观描述地点本身，不含主观感受，硬上限 150 字，超出请精简
- items：列出一切有助于生图细节描绘的家具/装饰/物件，各项合并后总长不超过 80 字
- directions：描述各出口（exits）对应的方位，与 exits 的 x/y 位置呼应，硬上限 80 字
- exploreSummary：只写一段连续总结，不超过 200 字；保留旧总结里仍成立的信息，把待压缩旧记录按时间融入，不要逐条罗列，不要重复 exploreNote 的内容
- exploreNote：只写本次新增的一条探索纪要，一句话；结合剧情上下文，不要重复旧记录`;

// 库路径（大地图/父节点地图）专用：无 exploreNote 字段
export const MAP_DESC_SCHEMA_DESC_NO_EXPLORE = `<MAP_DESC> 标签内输出一个 JSON 对象，结构如下：
{
  "summary": "地点简要介绍（建筑风格/布局/氛围/特征），50-150 字",
  "items": ["青瓷茶盏", "红木圆桌", "屏风", ...]（各项合并总长不超过 80 字）,
  "directions": "东侧通向厨房，南侧为出口返回上一级，西侧卧室..."（不超过 80 字）
}
要求：
- summary：客观描述地点本身，不含主观感受，硬上限 150 字，超出请精简
- items：列出一切有助于生图细节描绘的家具/装饰/物件，各项合并后总长不超过 80 字
- directions：描述各出口（exits）对应的方位，与 exits 的 x/y 位置呼应，硬上限 80 字`;

// ─────────────────────────────────────────────────────────────
// 风格片段（4 风格，per-card defaultStyle 驱动）
// ─────────────────────────────────────────────────────────────
export const STYLE_FRAGMENTS: Record<MapStyle, string> = {
  auto: '',
  ancient: '古代中式风格：木质建筑、飞檐斗拱、青砖黛瓦、烛台灯笼、屏风博古架。配色偏暗红/米白/青灰，线条古典圆润。',
  modern: '现代风格：混凝土/玻璃/钢结构、简洁几何、现代家具家电。配色偏中性灰白/冷色，线条利落直角。',
  scifi: '科幻风格：金属质感、霓虹光带、全息投影、流线型结构。配色偏深蓝/紫/荧光色，线条未来感。',
};

function styleLine(style: MapStyle): string {
  if (style === 'auto') return '日常生活（古代或现代均可，依据剧情上下文判断）';
  return STYLE_FRAGMENTS[style];
}

// ─────────────────────────────────────────────────────────────
// 统一提示词（无缓存 / 有缓存增量共用，hasCache 区分）
// ─────────────────────────────────────────────────────────────
export function buildMapPrompt(opts: {
  locationName: string;
  hasCache: boolean;
  style: MapStyle;
  mapSize: { width: number; height: number };
}): string {
  const styleStr = styleLine(opts.style);

  // 地图范围硬约束：聚焦当前地点内部，禁止把外部地点画成 rooms。
  // 修"当前房间生成时包含整栋房子布局"——靠显式指令约束 AI，不动上下文组装与 schema。
  const scopeRule = `【地图范围——严格遵守，违反即为错误】
本次只绘制「${opts.locationName}」这一地点的内部空间，画布 0-${opts.mapSize.width} × 0-${opts.mapSize.height} 即该地点的内部边界。
- rooms 只表示当前地点内部的功能分区：当前地点是整栋建筑/院落/街区时，rooms 是其内部各房间与区域；当前地点是单个房间时，rooms 是该间内部的功能区/陈设分区（如床区、桌区、窗边、门口），不要把单间再拆成多个"房间"。
- 父级、同级、子级地点一律用 exits 出口热点表示，绝不画成 rooms。禁止在当前地图里画出当前地点之外的任何房间、建筑、楼层或整体布局。
- 上下文中若出现上级或周围地点的「内部房间」列表、世界书里描述的其它房间，那仅供你理解方位、设置 exits 的 targetName 之用，绝对不可把它们画进 rooms 或当前地图。
- 当前地点是"整栋"还是"单间"按其名字与上下文判定：名字已指到具体单间（如"XX家-卧室"、"客厅"）就只画该间内部；名字指到建筑/区域（如"XX家"、"A小区"、"东市"）才画其内部多房间平面图。`;

  const readingGuide = `【绘制前必读】
请先充分阅读上方提供的所有信息，再开始绘制：
1. 「剧情上下文」——理解当前正在发生的场景、人物活动、环境氛围
2. 「地点相关条目库」——提取场景的具体描述（建筑风格、陈设布局、环境特征）
3. 「上级地点介绍」——理解本地点在整体空间中的位置，上级方位关系
4. 「已探索次级地点」——参考已发现的子地点方位，使 exits 出口位置与之匹配
5. 「该地点现有介绍」——（增量时）在现有介绍基础上更新，保留仍成立的，补充新发现
6. 「现有探索概况」与「待压缩的旧探索记录」——（存在时）把旧总结和待压缩旧记录合并成新的情况总结；「最近探索记录」用于避免重复
7. 「地图树节点情况」——地点连接的事实来源：当前地点的上级/同级/下级节点各是谁、已探索/未探索，exits 的 targetName 据此设置
基于以上信息判断场景的时代背景、室内外属性、功能分区，再据此设计地图结构并绘制精美 SVG。`;

  const designPrinciples = `关键设计原则：
1. 房间/区域之间物理上紧挨着，不用长线连接
2. 走廊本身就是一个长条形的区域
3. 区域坐标 (x,y,width,height) 边缘贴合，形成连通的整体
4. 地图布局可以不规则，符合真实建筑/场景的空间逻辑
5. 注意场景的日常合理性——居所、市集、庭院、街巷等均可能出现`;

  const outputBlocks = `请在同一次回复中输出三段，用标签包裹：

<MAP_JSON>
（完整的结构 JSON，含全部 rooms/doors/exits/characters，不是 diff；characters 仅使用“当前即时人物”）
</MAP_JSON>

<MAP_SVG>
（完整的精美 SVG 地图，坐标系与 JSON 完全一致 0-${opts.mapSize.width} × 0-${opts.mapSize.height}，房间/门坐标照搬 JSON；不画角色标记；仅地形/房间/门/装饰物；禁用 <g transform> 包裹房间矩形；viewBox 必须为 0 0 ${opts.mapSize.width} ${opts.mapSize.height}）
</MAP_SVG>

<MAP_DESC>
（探索介绍 JSON：summary/items/directions/exploreSummary/exploreNote）
</MAP_DESC>

${getMapJsonSchemaDesc(opts.mapSize, true)}
放在 <MAP_JSON> 标签内，不要 markdown 围栏。

${getSvgDetailRequirements(opts.mapSize)}

${MAP_DESC_SCHEMA_DESC}

请严格按 <MAP_JSON>、<MAP_SVG>、<MAP_DESC> 三段输出，便于程序分别提取，不输出任何其他额外内容。`;

  if (opts.hasCache) {
    return `你同时承担：资深场景地图架构师 + 顶级场景地图绘制大师 + 场景探索记录员。
地点：${opts.locationName}
场景风格：${styleStr}

${scopeRule}

${readingGuide}

【本任务为增量改写】
上方「该地点现有地图结构(JSON)」与「该地点现有地图(SVG)」是你上一版为该地点生成的地图。请在现有基础上改写，而非从零重画：
- 保留仍存在的房间 id 与坐标，仅按剧情变化调整
- 房间坐标尽量保持稳定，以保证前后一致性
- 如剧情发生明显场景转换，可较大幅度调整，但仍尽量复用可复用的坐标
- explorationDesc 在现有基础上更新：保留仍成立的 summary/items，补充新发现；directions 根据最新 exits 调整
- 探索记录：若上方有【待压缩的旧探索记录】，把它们与【现有探索概况】合并压缩成 exploreSummary（不超过 200 字）；否则 exploreSummary 原样沿用现有概况；exploreNote 只写本次新增的一条纪要，不重复「最近探索记录」
- exits 依据「地图树节点情况」尽可能更新：清单中的节点尽量给出出口（未探索的标注「（未探索）」），清单外的不新增；仍有效的出口尽量沿用「该地点现有连接」的坐标。受画布空间与场景逻辑限制无法全部体现时，优先保留上级、已探索、与剧情相关的连接，不强行画满。

${designPrinciples}

${outputBlocks}`;
  }

  return `你同时承担：资深场景地图架构师 + 顶级场景地图绘制大师 + 场景探索记录员。
地点：${opts.locationName}
场景风格：${styleStr}

${scopeRule}

${readingGuide}

${designPrinciples}

${outputBlocks}`;
}

// ─────────────────────────────────────────────────────────────
// 纯文字更新提示词（自动更新关闭重绘 / 新地点只建记录）
// ─────────────────────────────────────────────────────────────
export function buildMapTextUpdatePrompt(opts: { locationName: string; hasExistingMap: boolean }): string {
  const mapHint = opts.hasExistingMap
    ? '该地点已有地图画面，本次不重绘，只更新文字记录。'
    : '该地点还没有地图画面，本次只建立文字记录。';
  return `你同时承担：场景观察记录员 + 地点信息维护员。
地点：${opts.locationName}
${mapHint}

【硬约束】
- 本次只更新文字记录：不要输出 rooms / doors / exits / characters / SVG，也不要改变地图结构。
- 只能输出一个 <MAP_DESC> 标签，不要 markdown 围栏，不输出任何其他内容。

【更新口径】
- summary / items / directions：在【该地点现有介绍】基础上更新，保留仍成立的信息，补充新发现；directions 参考【该地点现有连接】与【地图树节点情况】。
- exploreSummary：若上方有【待压缩的旧探索记录】，把【现有探索概况】与这些旧记录合并压缩成不超过 200 字的连续总结；没有待压缩记录时原样沿用现有概况（没有则空串）。
- exploreNote：结合【剧情上下文】与【最近探索记录】，只写本次新增的一条探索纪要，一句话，不重复旧记录。

${MAP_DESC_SCHEMA_DESC}`;
}

// ─────────────────────────────────────────────────────────────
// user_input 各分段标题（用于组装时清晰分隔）
// ─────────────────────────────────────────────────────────────
export const MAP_INPUT_SECTIONS = {
  libraryHeader: '【地点相关条目库】',
  parentDescHeader: '【上级地点介绍】',
  childDescHeader: '【已探索次级地点】',
  currentDescHeader: '【该地点现有介绍】',
  currentRecordHeader: '【现有探索概况】',
  overflowRecordHeader: '【待压缩的旧探索记录】',
  recentRecordHeader: '【最近探索记录】',
  cacheJsonHeader: '【该地点现有地图结构(JSON)】',
  cacheSvgHeader: '【该地点现有地图(SVG)】',
  storyContextHeader: '【剧情上下文】',
  characterHeader: '【当前即时人物】',
  // 地图树邻接清单 + 上一版连接参考（树即真相：连接以树为准）
  neighborhoodHeader: '【地图树节点情况】',
  currentExitsHeader: '【该地点现有连接】',
  // 长按输入的额外提示词（仅本次生效，追加在末尾作为附加约束）
  extraHeader: '【用户额外要求】',
} as const;

// ─────────────────────────────────────────────────────────────
// 大地图提示词（期4，存储统一后改三段输出）
// ─────────────────────────────────────────────────────────────
export function buildLargeMapPrompt(opts: {
  rootName: string;
  style: MapStyle;
  hasCache: boolean;
  mapSize: { width: number; height: number };
}): string {
  const styleStr = styleLine(opts.style);

  const readingGuide = `【绘制前必读】
请先充分阅读上方提供的所有信息，再开始绘制：
1. 「地点相关条目库」——提取区域的具体描述（建筑风格、布局、环境特征）
2. 「该区域已探索地点」——理解各子地点的 summary/items/directions，据此判断各子地点的相对方位
3. 「该地点现有介绍」——（增量时）在现有介绍基础上更新，保留仍成立的，补充新发现
基于以上信息判断这是什么样的区域（居所群、市集街区、山林秘境、城镇俯瞰等），再据此设计地图结构并绘制精美 SVG。`;

  const designPrinciples = `关键设计原则：
1. 本地图是父节点的俯瞰图，展现整个区域的地理布局
2. 各子地点用图标（房屋/建筑/地标）表示，图标位置对应 exits 中 kind=child 的 x/y 坐标
3. 子地点之间用路径/道路/小径连接，体现通行关系
4. 俯瞰视角（top-down），整体低饱和度配色，淡雅不干扰阅读
5. 未探索的子地点也标出图标位置（前端会叠加迷雾效果）`;

  const outputBlocks = `请在同一次回复中输出三段，用标签包裹：

<MAP_JSON>
（完整的结构 JSON，含全部 rooms/doors/exits，不含 characters。exits 中 kind=child 的条目即为子地点标记位置）
</MAP_JSON>

<MAP_SVG>
（完整的区域俯瞰 SVG，坐标系与 JSON 完全一致 0-${opts.mapSize.width} × 0-${opts.mapSize.height}，房间/门坐标照搬 JSON；不画角色标记；仅地形/房间/门/装饰物；禁用 <g transform> 包裹房间矩形；viewBox 必须为 0 0 ${opts.mapSize.width} ${opts.mapSize.height}）
</MAP_SVG>

<MAP_DESC>
（探索介绍 JSON：summary/items/directions）
</MAP_DESC>

${getMapJsonSchemaDesc(opts.mapSize, false)}
放在 <MAP_JSON> 标签内，不要 markdown 围栏。

${getSvgDetailRequirements(opts.mapSize)}

${MAP_DESC_SCHEMA_DESC_NO_EXPLORE}

请严格按 <MAP_JSON>、<MAP_SVG>、<MAP_DESC> 三段输出，便于程序分别提取，不输出任何其他额外内容。`;

  if (opts.hasCache) {
    return `你同时承担：资深场景地图架构师 + 顶级场景地图绘制大师 + 场景探索记录员。
地点：${opts.rootName}
场景风格：${styleStr}

${readingGuide}

【本任务为增量改写】
上方「该地点现有地图结构(JSON)」与「该地点现有地图(SVG)」是你上一版为该地点生成的地图。请在现有基础上改写，而非从零重画：
- 保留仍存在的房间 id 与坐标，仅按新探索内容调整
- 房间坐标尽量保持稳定，以保证前后一致性
- 如有新探索的子地点，在 exits 中添加 kind=child 的条目
- explorationDesc 在现有基础上更新：保留仍成立的 summary/items，补充新发现；directions 根据最新 exits 调整

${designPrinciples}

${outputBlocks}`;
  }

  return `你同时承担：资深场景地图架构师 + 顶级场景地图绘制大师 + 场景探索记录员。
地点：${opts.rootName}
场景风格：${styleStr}

${readingGuide}

${designPrinciples}

${outputBlocks}`;
}

// ─────────────────────────────────────────────────────────────
// 大地图 user_input 分段标题
// ─────────────────────────────────────────────────────────────
export const LARGE_MAP_INPUT_SECTIONS = {
  libraryHeader: '【地点相关条目库】',
  childDescHeader: '【该区域已探索地点】',
  currentDescHeader: '【该地点现有介绍】',
  cacheJsonHeader: '【该地点现有地图结构(JSON)】',
  cacheSvgHeader: '【该区域现有大地图(SVG)】',
  // 长按输入的额外提示词（仅本次生效，追加在末尾作为附加约束）
  extraHeader: '【用户额外要求】',
} as const;

