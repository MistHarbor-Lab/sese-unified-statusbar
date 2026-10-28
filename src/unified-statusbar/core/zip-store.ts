// ===== ZIP 打包（store 模式，无压缩） =====
// 纯函数零依赖：立绘图库批量导出等场景用。method 0（stored）+ CRC32 校验；
// general purpose flag 置 0x0800（UTF-8 文件名），中文条目名在 Windows 解压不乱码。
// 参考 V3.436 实现移植；新增 4GB 单文件防护（超长跳过而非 setUint32 静默溢出）。

export interface ZipStoreEntry {
  name: string;
  blob: Blob;
}

/** 单文件 > 4GiB 时 ZIP 的 size/offset 字段无法表达（32bit），跳过该文件 */
const MAX_ZIP_SIZE = 0xffffffff;

function crc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
}

function dosDateTime(date: Date): { time: number; dateValue: number } {
  const year = Math.max(1980, date.getFullYear());
  const time = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xffff;
  const dateValue = (((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
  return { time, dateValue };
}

export async function buildZipStoreBlob(entries: ZipStoreEntry[]): Promise<Blob> {
  const encoder = new TextEncoder();
  const crcTable = crc32Table();
  const crcOf = (bytes: Uint8Array): number => {
    let crc = 0xffffffff;
    for (const b of bytes) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  const u16 = (view: DataView, offset: number, value: number): void => view.setUint16(offset, value, true);
  const u32 = (view: DataView, offset: number, value: number): void => view.setUint32(offset, value, true);

  const now = new Date();
  const { time, dateValue } = dosDateTime(now);
  const locals: Uint8Array<ArrayBuffer>[] = [];
  const centrals: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = new Uint8Array(await entry.blob.arrayBuffer());
    if (data.length > MAX_ZIP_SIZE) continue;   // 4GiB+ 单文件跳过（32bit 字段无法表达）
    const crc = crcOf(data);

    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer, local.byteOffset, local.byteLength);
    u32(lv, 0, 0x04034b50);
    u16(lv, 4, 20);          // version needed
    u16(lv, 6, 2048);        // flag: UTF-8 文件名
    u16(lv, 8, 0);           // method: stored
    u16(lv, 10, time);
    u16(lv, 12, dateValue);
    u32(lv, 14, crc);
    u32(lv, 18, data.length);
    u32(lv, 22, data.length);
    u16(lv, 26, nameBytes.length);
    u16(lv, 28, 0);          // extra length
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer, central.byteOffset, central.byteLength);
    u32(cv, 0, 0x02014b50);
    u16(cv, 4, 20);          // version made by
    u16(cv, 6, 20);          // version needed
    u16(cv, 8, 2048);        // flag: UTF-8 文件名
    u16(cv, 10, 0);          // method: stored
    u16(cv, 12, time);
    u16(cv, 14, dateValue);
    u32(cv, 16, crc);
    u32(cv, 20, data.length);
    u32(cv, 24, data.length);
    u16(cv, 28, nameBytes.length);
    u16(cv, 30, 0);          // extra length
    u16(cv, 32, 0);          // comment length
    u16(cv, 34, 0);          // disk number start
    u16(cv, 36, 0);          // internal attrs
    u32(cv, 38, 0);          // external attrs
    u32(cv, 42, offset);
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length;
  }

  const cdSize = centrals.reduce((sum, c) => sum + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  u32(ev, 0, 0x06054b50);
  u16(ev, 4, 0);             // disk number
  u16(ev, 6, 0);             // cd start disk
  u16(ev, 8, centrals.length);
  u16(ev, 10, centrals.length);
  u32(ev, 12, cdSize);
  u32(ev, 16, offset);
  u16(ev, 20, 0);            // comment length

  return new Blob([...locals, ...centrals, eocd], { type: 'application/zip' });
}

/** 触发浏览器下载（U36：blob→文件下载的规范口）。超集语义：链接隐藏挂载、click 抛错时先回收
 *  URL 再向上透传（archive-export 靠此包错误卡片）、成功后延迟 1s 回收（防竞态取消下载）。 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.hidden = true;
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try {
    link.click();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  } finally {
    link.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
