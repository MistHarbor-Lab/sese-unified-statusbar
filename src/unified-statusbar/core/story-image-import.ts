// ===== 正文插图 → 角色图库（立绘）转入：纯函数 =====
// 转入语义（用户拍板）：复制而非引用——把服务器图片复制一份进立绘目录，两边独立、可分别删除。
// 本文件零运行时依赖（仅 type import），供测试直读。
import type { PortraitEntry } from './portrait-system';

/** 描述里姓名子串命中的角色排最前（组内保持原顺序=恋爱对象表优先）；描述为空/无命中原样返回。 */
export function sortCharactersMatchedFirst(names: string[], description: string): string[] {
  const desc = String(description || '');
  if (!desc) return names.slice();
  const matched: string[] = [];
  const rest: string[] = [];
  for (const name of names) (desc.includes(name) ? matched : rest).push(name);
  return [...matched, ...rest];
}

/** 文生图条目 → 立绘条目字段映射：两边都有→原样（path/filename/promptText/gen/createdAt）；
 *  文生图独有→丢弃（description/charName/id）；立绘独有→留默认（emotion/nsfw 不快照，
 *  negativePrompt 例外：从 gen.negative 复制，与本地导入条目结构对齐）。 */
export function buildImportedPortraitEntry(
  source: { promptText?: string; gen?: PortraitEntry['gen']; createdAt?: number },
  path: string,
  filename: string,
): PortraitEntry {
  return {
    path,
    filename,
    promptText: String(source.promptText || ''),
    negativePrompt: source.gen?.negative || '',
    composeMode: 'none',
    preset: 'default',
    theme: 'default',
    extraPrompt: '',
    width: 0,
    height: 0,
    createdAt: typeof source.createdAt === 'number' ? source.createdAt : 0,
    ...(source.gen ? { gen: source.gen } : {}),
  };
}
