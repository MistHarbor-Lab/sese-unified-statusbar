// ===== 全局外部存储命名空间 · 单一登记处 =====
// F7：bootstrap 的注册装配与 hard-reset 的候选文件推导此前各持一份手写清单，
// 曾漂移出「hard-reset 漏扫 story-images」——一键清空后图库残留。
// 新增全局命名空间时只改这里；两侧都从本表读取，结构上不再可能出现第二份清单。
export const GLOBAL_STORAGE_NAMESPACES = ['preferences', 'achievements', 'warehouse', 'wardrobe-catalog', 'story-images'] as const;
