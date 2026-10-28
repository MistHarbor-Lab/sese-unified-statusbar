// ===== 瑟瑟能量统一出口（U31·第十三轮）=====
// 此前 13 个玩法点位各自手写「读能量→判够不够→扣→（也许）返还」，四套脾气并存：
// 写入通道两派（runDbBatch 原子批 vs updateCell 直写）、失败退款三派（返还/不返还/回滚预留）、
// 余额不足提示两派（规范入口 vs 手写文案各异）、数字细节不一（有无钳制/进制声明）。
//
// 收编边界（用户已拍板）：
//   · 只收编「读、判、规范提示、写」四件同形小事；
//   · 各点位的退款语义与写入通道**逐点保持**（那是行为，不趁机统一——退款三口径统一需另行拍板）；
//   · 唯一主动统一：余额不足提示走规范文案「瑟瑟能量不足（当前 X / 需要 Y）」（口径 A，13 处一致）。
// 点位清单：单抽/十连（gacha）、日历长按刷新（calendar-ai）、剧情特卖生成/买技能书/买物品
// （shop-story-ai）、商店手动刷新/买物品/买技能书（shop-regular）、天赋树激活混合扣费
// （skill-activation·含退款）、天赋树批量生成中止文案（skill-tree-engine）、任务结算加能量
// （popup-manager·入账方向）、买衣柜商品（shop-wardrobe·经 deps 注入）。
import { getCellByHeader, incrementCell, type DbWriteOp } from './data-manager';
import { showEnergyShort } from './notify-presets';

/** 瑟瑟能量的存储位置（主角信息表首行「瑟瑟能量」列）。 */
export const SERSE_ENERGY_TABLE = '主角信息表';
export const SERSE_ENERGY_COLUMN = '瑟瑟能量';
export const SERSE_ENERGY_ROW_ID = 1;

/** 读当前瑟瑟能量（表缺/行缺/非数字当 0——与收编前各点位 parseInt(...||'0')||0 逐字同口径）。 */
export function readSerseEnergy(): number {
  return parseInt(getCellByHeader(SERSE_ENERGY_TABLE, SERSE_ENERGY_ROW_ID, SERSE_ENERGY_COLUMN) || '0', 10) || 0;
}

/** 够不够（只判不提示）。 */
export function serseEnergyEnough(need: number): boolean {
  return readSerseEnergy() >= need;
}

/** 余额不足规范提示（口径 A 统一文案）。current 可传入已读到的值，省一次重复读表。 */
export function warnSerseEnergyShort(module: string, need: number, current?: number): void {
  showEnergyShort(module, need, current ?? readSerseEnergy());
}

/**
 * 原子批操作：塞进各点位既有 runDbBatch 的 ops 数组（通道不变，只统一拼装）。
 * **入参是增量 delta，不是目标值**：并发下相对表达式由引擎逐行取当前值计算，两个 +N 都会生效；
 * 旧的「读当前值→算目标值→写绝对值」在并发窗口里只会生效一次（丢增量）。
 */
export function serseIncrementOp(delta: number): DbWriteOp {
  return {
    kind: 'incrementCell',
    tableName: SERSE_ENERGY_TABLE,
    rowId: SERSE_ENERGY_ROW_ID,
    colName: SERSE_ENERGY_COLUMN,
    delta: Math.trunc(Number(delta) || 0),
  };
}

/** 直写（「先扣后做」通道）：日历/商店刷新/剧情特卖/衣柜退款走这里；入参同为增量 delta。 */
export function adjustSerseEnergy(delta: number): Promise<boolean> {
  return incrementCell(SERSE_ENERGY_TABLE, SERSE_ENERGY_ROW_ID, SERSE_ENERGY_COLUMN, Math.trunc(Number(delta) || 0));
}

/** 直写通道扣减：读一次仅用于「够不够」判定，落账走相对表达式（扣减不会因并发读丢失）。 */
export async function deductSerseEnergyDirect(amount: number): Promise<boolean> {
  const energy = readSerseEnergy();
  if (energy < amount) return false;
  return adjustSerseEnergy(-Math.abs(amount));
}

/** 直写通道返还（best-effort，失败不抛）。 */
export async function refundSerseEnergyDirect(amount: number): Promise<void> {
  await adjustSerseEnergy(Math.abs(amount));
}
