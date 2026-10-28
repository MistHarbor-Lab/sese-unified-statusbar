// ===== 立绘图库批量导出编排 =====
// 纯逻辑（fetch 依赖注入，默认浏览器 fetch）：逐张串行读取图片 → 失败项跳过并计数 →
// 单张直接返回原图 blob，多张打包 zip（core/zip-store.ts）。修复参考实现"一败全输"：任一
// 图片读取失败不再让整个导出作废，而是跳过并在结果中汇总失败数。

import { padNumber } from './number';
import { buildZipStoreBlob, type ZipStoreEntry } from './zip-store';

export interface PortraitBatchExportItem {
  /** 图片路径（/user/images/unified-statusbar/...，可直接 fetch） */
  path: string;
  /** 服务器端原始文件名（zip 内条目名的来源） */
  filename: string;
}

export interface PortraitBatchExportResult {
  /** 成功读取的图片数 */
  exported: number;
  /** 读取失败的图片数 */
  failed: number;
  /** 单张导出（exported === 1 且 failed === 0）时提供：原图 blob 与下载名 */
  singleBlob?: Blob;
  singleName?: string;
  /** 多张导出（exported >= 2）时提供：zip blob 与下载名（zipName 已含扩展名） */
  zipBlob?: Blob;
  zipName?: string;
}

/** 下载文件名的安全化（镜像 image-storage 的 sanitizeFilenamePart 语义：非法字符转 _） */
export function safeDownloadName(value: string, fallback = 'portrait'): string {
  const cleaned = String(value || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    // 控制字符逐字转 _（正则含控制字符范围会触发 no-control-regex）
    .split('')
    .map((ch) => (ch.charCodeAt(0) < 32 ? '_' : ch))
    .join('')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80);
  return cleaned || fallback;
}

/** 导出时间戳（YYYYMMDD_HHMMSS，zip 下载名用） */
export function exportTimestamp(date = new Date()): string {
  return `${date.getFullYear()}${padNumber(date.getMonth() + 1)}${padNumber(date.getDate())}_${padNumber(date.getHours())}${padNumber(date.getMinutes())}${padNumber(date.getSeconds())}`;
}

/**
 * 批量导出：items 为空返回 { exported: 0, failed: 0 }。
 * 单张成功 → singleBlob/singleName；多张（含部分失败）→ zipBlob/zipName；
 * 全部失败 → 无产出，调用方按 failed 提示。
 */
export async function exportPortraitBatch(
  items: PortraitBatchExportItem[],
  zipBaseName: string,
  fetchFn: typeof fetch = fetch,
): Promise<PortraitBatchExportResult> {
  if (items.length === 0) return { exported: 0, failed: 0 };

  // 单张：读取失败直接报失败，不产 blob
  if (items.length === 1) {
    try {
      const response = await fetchFn(items[0].path, { credentials: 'same-origin' });
      if (!response.ok) return { exported: 0, failed: 1 };
      const blob = await response.blob();
      return { exported: 1, failed: 0, singleBlob: blob, singleName: safeDownloadName(items[0].filename) };
    } catch (_e) {
      return { exported: 0, failed: 1 };
    }
  }

  // 多张：逐张串行读取，失败项跳过（修复"一败全输"）；条目名 NNN_ 前缀编号防重名
  const entries: ZipStoreEntry[] = [];
  let failed = 0;
  for (let i = 0; i < items.length; i++) {
    try {
      const response = await fetchFn(items[i].path, { credentials: 'same-origin' });
      if (!response.ok) { failed++; continue; }
      const blob = await response.blob();
      entries.push({
        name: `${String(i + 1).padStart(3, '0')}_${safeDownloadName(items[i].filename, `portrait_${i + 1}.png`)}`,
        blob,
      });
    } catch (_e) {
      failed++;
    }
  }
  if (entries.length === 0) return { exported: 0, failed };

  const zipBlob = await buildZipStoreBlob(entries);
  return {
    exported: entries.length,
    failed,
    zipBlob,
    zipName: `${safeDownloadName(zipBaseName)}_${exportTimestamp()}.zip`,
  };
}
