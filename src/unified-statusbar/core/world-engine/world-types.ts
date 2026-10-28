// core/world-engine/world-types.ts
// 世界演化窗口数据结构与常量。后续任务全部依赖这些名字。

export type EvolveKind = 'small' | 'big';

export const WORLD_FEATURE_KEY = 'world';
export const WORLD_SCHEMA_VERSION = 1;
export const DEFAULT_EVOLVE_EVERY_TURNS = 1;
export const DEFAULT_FOCUS_MAX = 6;
export const DEFAULT_ROTATION_BATCH = 4;
export const CHRONICLE_MAX = 10; // 演化纪事窗口展示上限（用户指定：60 → 10）
export const INTRUSION_QUEUE_MAX = 30;
export const INTRUSION_ACT_TTL = 2; // 已触发入镜事件保留的演化轮数（触发时置 2，每轮演化 -1，归 0 删除）
// ===== F28：主动入镜（自由通道）限流四闸的常量 =====
export const INTRUSION_FREE_PER_ROUND = 1;      // 每轮自由通道（非线程完成）最多入镜人数
export const INTRUSION_COOLDOWN_ROUNDS = 6;     // 同一角色两次自由入镜之间的最小间隔轮数
export const INTRUSION_FREE_PENDING_MAX = 2;    // 队列中「pending 且自由通道」入镜的条数上限
export const ARRIVAL_CONDITION_TTL_ROUNDS = 3;  // 入镜条件有效期（轮）：超期未消费即清空，需 AI 重新确认
export const INTRUSION_DESC_MIN = 40;           // 入镜事件描述字数下限（与提示词「40-120 字」一致）
export const RUMOR_KEEP_MAX = 60; // v1.1：传闻存储上限，防止长期演化无界增长
export const THREAD_FOCUS_MAX = 2; // 每轮最多进焦点的暗中打算线程角色数（防焦点被线程角色占满）
export const DEFAULT_CHRONICLE_TOTAL = 50; // v2：世界演化注入的纪要总量（默认 50；每焦点每轮保底 5 条）
/** 演化自动更新最小回复字数：最新 AI 回复字符数低于该值跳过自动演化（设置面板可配，默认 200）。 */
export const DEFAULT_EVOLVE_MIN_REPLY = 200;

// ─── 小手机联动（世界演化主动联系 + 社媒内容产出） ───

/** 社媒评论（演化产出完整帖子的配套内容；落库经小手机侧 normalizeSocialComment 兜底）。 */
export interface WorldPhoneComment {
  /** 评论者（焦点角色或路人；主角名在小手机落库层被屏蔽）。 */
  name: string;
  /** 评论正文。 */
  text: string;
  /** 被回复评论者名（楼中楼指针；可空 = 顶层评论）。 */
  replyTo?: string;
}

/** 主动联系 / 社媒帖事件（AI 在 <world> 的 <phone> 块输出；经宿主桥 window.__ubp_world_inject 推入瑟瑟小手机）。 */
export interface WorldPhoneEvent {
  kind: 'message' | 'call' | 'social';
  /** message/call：发起角色名（须为本轮焦点角色，实体协议）。social：发帖人（允许路人，主角名在落库层屏蔽）。 */
  name: string;
  /** message/social：消息 / 帖子正文。 */
  text?: string;
  /** call：接通后的开场白（接听时打字机投递）。 */
  lines?: string[];
  /** call：对方此刻内心想法（玩家元信息）。 */
  thought?: string;
  /** social：平台。 */
  platform?: 'moments' | 'tieba' | 'weibo' | 'xhs';
  /** social：帖子标题（tieba/xhs 必填，其余平台无此字段）。 */
  title?: string;
  /** social：贴吧吧名（tieba 必填）。 */
  bar?: string;
  /** social：配图画面描述（可空 = 无图；小手机既有生图管线接管）。 */
  image?: string;
  /** social：评论区（完整产出）。 */
  comments?: WorldPhoneComment[];
  /** social：点赞人名（仅朋友圈）。 */
  likes?: string[];
}

/** 单轮事件条数上限（提示词约定联动内容合计 1-3 份，此为容错上限：含消息连发）。 */
export const WORLD_PHONE_EVENTS_MAX = 8;
/** 消息文本 / 帖子正文上限。 */
export const WORLD_PHONE_MESSAGE_CHARS = 300;
/** 来电开场白条数上限。 */
export const WORLD_PHONE_CALL_LINES = 6;
/** 单句开场白上限。 */
export const WORLD_PHONE_LINE_CHARS = 120;
/** 内心想法上限。 */
export const WORLD_PHONE_THOUGHT_CHARS = 200;
/** 社媒帖单帖评论条数上限。 */
export const WORLD_SOCIAL_COMMENTS_MAX = 6;
/** 社媒帖点赞人名上限。 */
export const WORLD_SOCIAL_LIKES_MAX = 4;
/** 社媒帖标题 / 评论者名上限。 */
export const WORLD_SOCIAL_TITLE_CHARS = 60;
/** 社媒评论内容上限。 */
export const WORLD_SOCIAL_COMMENT_CHARS = 120;
/** 社媒图片描述上限。 */
export const WORLD_SOCIAL_IMAGE_CHARS = 160;

export interface WorldState {
  version: number;
  lastEvolveRound: number;
  lastEvolveDateKey: string;
  profiles: Record<string, CharProfile>;
  rumors: Rumor[];
  chronicle: ChronicleEntry[];
  frontDigest: string;
  pendingIntrusions: Intrusion[];
  /** 演化停用名单（角色名）：幕后删除动向并停用演化时记入；仅当前聊天生效，syncWorldRoster 不再为其建侧写。 */
  evolveExcluded?: string[];
}

export interface CharProfile {
  name: string;
  onStage: boolean;
  activity: string;
  plans: string;
  hiddenGoal?: string;
  /** 暗中打算线程进度 0-100（引擎推进，只升不降；阶段由 charThreadStage 派生）。 */
  goalProgress?: number;
  /** 进展文字说明：AI 按进度写，体现目标推进的具体情况（数量/地点/时间，如「已经攒了 60 两银子，还差 40 两」）。 */
  goalProgressText?: string;
  /** 线程完成留痕（完成日期 YYYY-MM-DD；展示「已完成（dateKey）」）。 */
  goalDone?: string;
  relation?: string;
  /** 入镜条件（F28 复活）：该角色会主动来找主角的**前置状态**（AI 每轮可重写；入队成功后消费清空）。
   *  是自由通道的唯一凭证——非线程完成角色必须满足它才会被放行入队。 */
  arrivalCondition?: string;
  /** 入镜条件的写入轮次（F28）：用于 TTL 过期判定（超 ARRIVAL_CONDITION_TTL_ROUNDS 轮未消费即清空）。 */
  arrivalConditionAt?: number;
  /** 最近一次自由入镜成功入队的轮次（F28）：冷却闸依据（同角色间隔 ≥ INTRUSION_COOLDOWN_ROUNDS）。 */
  lastArrivalRound?: number;
  updatedAt: string;
  lastEvolveRound: number;
}

export interface Rumor {
  id: string;
  /** 主题固定不变（创建时由 AI 定，之后引擎忽略任何主题变更）。 */
  topic: string;
  /** 渐进重写内容（保留已确立信息，AI 每轮补新增细节/议论/反转）。 */
  content: string;
  level: 'known' | 'heard' | 'vague';
  /** 本阶段发展度 1-100（前端维护；AI 给增量；每阶段从 1 走到 100，满 100 晋级下一阶段并重置为 1）。 */
  progress: number;
  /** 消散度 0-100（前端维护；AI 给减量；进台前那一刻重置 100、不随阶段变化刷新；归 0 即删除）。幕后 vague 无值/未激活时缺省。 */
  dissipation?: number;
  createdAt: string;
}

/** 回廊增量：一轮演化里「什么变了」的结构化快照。
 *  全部由 generateChronicle 对 prev/next 两个状态本地差分得出，不消耗任何 AI 输出/token。
 *  可选字段：旧存档的纪事没有它，前端降级为「摘要 + 变更名单」展示。 */
export interface ChronicleDelta {
  /** 角色动向变化（activity 旧值→新值）。 */
  profiles?: { name: string; from: string; to: string }[];
  /** 角色「打算」变化（plans 旧值→新值）。
   *  ★必须与 generateChronicle 的 changedProfiles 同判据：那份判据**算进了 plans**，
   *  而这里以前不收 ⇒ 只改打算的角色在回廊里彻底隐形（算进了「变了」却发不出行）。 */
  plans?: { name: string; from: string; to: string }[];
  /** 传闻进展与等级跃迁；本轮新出现的传闻无 fromLevel/fromProgress。 */
  rumors?: { topic: string; fromLevel?: string; toLevel?: string; fromProgress?: number; toProgress?: number }[];
  /** 暗中打算线程进度（主角不知信息，前端须带标注）；goal=该角色 hiddenGoal 全文，
   *  没有它这一行只有数字、读不出「他到底想干什么」。 */
  threads?: { name: string; from?: number; to?: number; goal?: string }[];
  /** 本轮新入镜事件；hook=该事件的钩子文本（状态里本就有，只是以前没发出来）。 */
  intrusions?: { refId: string; title?: string; hook?: string }[];
}

export interface ChronicleEntry {
  id: string;
  dateKey: string;
  kind: EvolveKind;
  summary: string;
  changed: { profiles: string[]; rumors: string[]; rumorsGone: string[] };
  /** 回廊用差分快照（可选，零迁移：旧纪事无此字段）。 */
  deltas?: ChronicleDelta;
}

export interface Intrusion {
  id: string;
  kind: 'character_arrival';
  refId: string;
  title: string;
  hook?: string;
  /** 事件描述（完整前因后果）：character_arrival 必填，供角色动态绿灯条目注入。 */
  desc?: string;
  dateKey: string;
  /** 两态：pending=待处理；acted=已触发（TTL 内存活，前端每轮演化递减，归 0 删除）。 */
  status: 'pending' | 'acted';
  /** 仅 acted 有意义：剩余存活演化轮数（触发时=INTRUSION_ACT_TTL）。 */
  ttl?: number;
  aiTriggered: boolean;
  /** F28：本条是否走「自由通道」（有 arrivalCondition 的主动入镜）。缺省/undefined=线程完成通道
   *  （强制入镜）。仅用于配额闸统计 pending 自由入镜条数；旧存档条目无该字段 ⇒ 不计入自由额度。 */
  freeArrival?: boolean;
}

export interface EvolveConfig {
  evolveEveryTurns: number;
  focusMax: number;
  rotationBatch: number;
  /** v2：世界演化注入的纪要总量（可选；缺省 50）。 */
  worldChronicleTotal?: number;
  /** 最近剧情上下文条数（可选；缺省 2）。 */
  worldContextCount?: number;
  /** 演化风格方向：general/sweet/intrigue/surprise/custom（缺省 general=不加额外要求）。 */
  worldEvolveStyle?: string;
  /** 演化风格自定义要求（worldEvolveStyle=custom 时生效）。 */
  worldEvolveStyleCustom?: string;
  /** 自动更新最小回复字数（可选；缺省 200）。手动演化不受此限制。 */
  evolveMinReply?: number;
  /** 小手机联动（可选；缺省 false）：提示词注入「主动联系」规则并允许 <phone> 块，落盘后事件推入小手机。
   *  由 config 源合成：用户开关开启 且 宿主桥可用（瑟瑟小手机正在运行）。 */
  worldPhoneLink?: boolean;
}

export function emptyWorldState(): WorldState {
  return {
    version: WORLD_SCHEMA_VERSION,
    lastEvolveRound: 0,
    lastEvolveDateKey: '',
    profiles: {},
    rumors: [],
    chronicle: [],
    frontDigest: '',
    pendingIntrusions: [],
    evolveExcluded: [],
  };
}
