// ===== 统一状态栏 · 一键搬家外部存储复制扩展桥 =====
//
// 一键搬家（chat-relocation）只为「外部存储域」（story-core/story-map/portraits）做切割复制；
// 伴生插件自有的 storageId 域文件（如小手机 usb_phone_<h>.json 与备份族）不在 ChatStorageDomain
// 枚举内，搬家后新 storageId 下没有这些文件——插件重绑到新身份即表现为「数据凭空消失」。
//
// 本桥提供扩展点：伴生插件在引导时注册一个复制器，搬家在写完主项目三域后按注册顺序调用，
// 把自有域文件也复制/改签到新 storageId。跨 bundle 经主项目 index.ts 的 window.__ubStorageRelocation
// 暴露（与 __ubWorldbookProjection 同款纪律：桥不存在=主项目未加载/版本过旧，插件侧零破坏）。
//
// 纪律：best-effort。单个复制器失败/抛错既不断搬家，也不影响其它复制器；未注册时零开销。

import type { ChatOwner } from './chat-storage-identity';

export interface StorageRelocationCopyContext {
  /** 父聊天 storageId（复制来源）。 */
  parentStorageId: string;
  parentOwner: ChatOwner;
  /** 新聊天 storageId（复制目标，由搬家全新生成）。 */
  newStorageId: string;
  newOwner: ChatOwner;
  /** 新聊天 file_name（owner.chatId）。 */
  newChatId: string;
  /** 切割层在原聊天 chat 数组中的下标（含本层；新聊天从这一层起）。
   *  需要「按楼层烘焙/切割」的复制器（如瑟瑟台账）用它换算自己的楼层口径。 */
  cutMessageIndex?: number;
  /** 新聊天的消息数组（已剔除 chatHeader，未注入元数据）：复制器可按锚点计算要结转的条目。 */
  retainedChat?: unknown[];
  /** 复制器可写入的聊天元数据补丁：搬家把它合并进新聊天 chat_metadata（同名键覆盖父聊天旧值）。
   *  典型用法＝台账把新聊天改签到自己的新 storageId（seseLedger 命名空间）。 */
  chatMetadataPatch?: Record<string, unknown>;
}

export type StorageRelocationCopier = (context: StorageRelocationCopyContext) => unknown;

const _copiers: StorageRelocationCopier[] = [];

/** 注册复制器（同函数引用幂等；返回是否新增）。 */
export function registerStorageRelocationCopier(copier: StorageRelocationCopier): boolean {
  if (typeof copier !== 'function' || _copiers.includes(copier)) return false;
  _copiers.push(copier);
  return true;
}

/** 注销复制器（插件真卸载/重注入时调用；返回是否移除）。旧版主项目无此方法，插件侧特性探测。 */
export function unregisterStorageRelocationCopier(copier: StorageRelocationCopier): boolean {
  const index = _copiers.indexOf(copier);
  if (index < 0) return false;
  _copiers.splice(index, 1);
  return true;
}

/** 是否已有复制器注册（诊断用）。 */
export function hasStorageRelocationCopier(): boolean {
  return _copiers.length > 0;
}

/**
 * 依次执行已注册复制器，返回失败数（供调用方日志记录）。
 * 单个失败被吞掉且绝不抛出——搬家主流程（数据库快照/聊天文件写入）不因伴生插件自有域复制失败而中断。
 */
export async function runStorageRelocationCopiers(context: StorageRelocationCopyContext): Promise<number> {
  let failed = 0;
  for (const copier of [..._copiers]) {
    try {
      await Promise.resolve(copier(context));
    } catch (_e) {
      failed += 1;
    }
  }
  return failed;
}
