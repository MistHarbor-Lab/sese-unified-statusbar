// ===== 数据克隆（U11，零依赖纯模块）=====
//
// 背景：同一件「深拷贝」写了两种脾气、共 5 份：
//   · 纯 JSON 往返（`clone<T>`）——map-merge / map-location-identity / wardrobe-store / wardrobe-queue 各一份
//   · structuredClone 优先、旧内核回退 JSON——cycle-external-api 的 `deepClone`
//
// 沿用 U7 的纪律：**脾气各自保留、只集中实现、不统一化**（把纯 JSON 那 4 份改成 structuredClone
// 优先属于行为变更：structuredClone 对函数/DOM 节点抛错、对 undefined 的行为也不同）。
//
// ★刻意**不收编**（语义不同，动了就是变更）：
//   · `core/external-storage-codec.ts#cloneJson` —— null/undefined **原样返回**（契约不同，且是导出 API）
//   · `core/worldbook-projection.ts#cloneEntries` —— structuredClone 缺失时回退**浅拷贝 `{...entry}`**
//     （只对 entry 数组成立，不能当通用深拷贝）

/** 纯 JSON 往返深拷贝（与原 `clone<T>` 逐字节等价）。 */
export function plainClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** 优先 `structuredClone`，不可用/不可克隆时回退 JSON 往返（与原 `deepClone` 逐字节等价）。 */
export function safeClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch (_e) { /* fall through */ }
  }
  return JSON.parse(JSON.stringify(value));
}
