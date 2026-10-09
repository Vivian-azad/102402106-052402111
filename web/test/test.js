/**
 * test.js —— 核心逻辑单元测试（零依赖，Node 直接运行）
 * ------------------------------------------------------------------
 * 运行方式：  node test/test.js
 * 测试对象：  web/js/core.js 中的纯函数
 * 测试方法：  白盒测试（分支覆盖）+ 边界值 + 异常分支
 *
 * 测试框架说明：
 *   为了做到「任何人下载后无需 npm install 即可一键运行」，
 *   这里没有引入 Jest/Mocha，而是用 Node 内置的 assert 模块
 *   手写了一个极简测试运行器。它同样实现了「用例组织、断言、
 *   统计通过/失败、失败时给出期望值 vs 实际值」等核心能力。
 */
const assert = require('assert')
const Core = require('../js/core.js')

let passed = 0
let failed = 0
const failures = []

function test(name, fn) {
  try {
    fn()
    passed++
    console.log('  ✓ ' + name)
  } catch (e) {
    failed++
    failures.push({ name, msg: e.message })
    console.log('  ✗ ' + name)
    console.log('      ' + e.message.replace(/\n/g, '\n      '))
  }
}

console.log('\n========== 校园失物招领 · 核心逻辑单元测试 ==========\n')

/* ============================================================
 * 一、发布校验 validatePublish（分支覆盖）
 * ============================================================ */
console.log('【一】发布校验 validatePublish')

test('1. 合法输入：应通过校验', () => {
  const r = Core.validatePublish({ type: '寻物', title: '校园卡', place: '教学楼', contact: '13800001111' })
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.errors.length, 0)
})

test('2. 缺少物品名称：应报错', () => {
  const r = Core.validatePublish({ type: '寻物', title: '', place: '教学楼', contact: '13800001111' })
  assert.strictEqual(r.ok, false)
  assert.ok(r.errors.some(e => e.indexOf('物品名称') > -1))
})

test('3. 缺少地点：应报错', () => {
  const r = Core.validatePublish({ type: '招领', title: '雨伞', place: '', contact: '13800001111' })
  assert.strictEqual(r.ok, false)
  assert.ok(r.errors.some(e => e.indexOf('地点') > -1))
})

test('4. 缺少联系方式：应报错', () => {
  const r = Core.validatePublish({ type: '寻物', title: '钥匙', place: '宿舍区', contact: '' })
  assert.strictEqual(r.ok, false)
  assert.ok(r.errors.some(e => e.indexOf('联系方式') > -1))
})

test('5. 非法类型：应报错', () => {
  const r = Core.validatePublish({ type: '转让', title: '书', place: '图书馆', contact: '138' })
  assert.strictEqual(r.ok, false)
})

test('6. 标题超长（边界值 >30 字符）：应报错', () => {
  const r = Core.validatePublish({ type: '寻物', title: '字'.repeat(31), place: '食堂', contact: '138' })
  assert.strictEqual(r.ok, false)
  assert.ok(r.errors.some(e => e.indexOf('30') > -1))
})

test('7. 标题恰好 30 字符（边界值 =30）：应通过', () => {
  const r = Core.validatePublish({ type: '寻物', title: '字'.repeat(30), place: '食堂', contact: '138' })
  assert.strictEqual(r.ok, true)
})

/* ============================================================
 * 二、搜索过滤 filterItems
 * ============================================================ */
console.log('【二】搜索过滤 filterItems')

const sampleItems = [
  { _id: 'a', type: '寻物', title: '校园卡', description: '黑色', place: '教学楼', status: '进行中', createTime: '2026-09-26 10:00' },
  { _id: 'b', type: '招领', title: '折叠雨伞', description: '蓝色', place: '食堂', status: '进行中', createTime: '2026-09-25 10:00' },
  { _id: 'c', type: '寻物', title: '蓝牙耳机', description: '白色', place: '图书馆', status: '已找到', createTime: '2026-09-24 10:00' },
  { _id: 'd', type: '招领', title: '钥匙', description: '小熊挂件', place: '宿舍区', status: '进行中', createTime: '2026-09-23 10:00' }
]

test('8. 按关键词匹配标题：只返回匹配项', () => {
  const r = Core.filterItems(sampleItems, { keyword: '校园卡', status: '进行中' })
  assert.strictEqual(r.length, 1)
  assert.strictEqual(r[0]._id, 'a')
})

test('9. 关键词匹配描述（非标题）：也能命中', () => {
  const r = Core.filterItems(sampleItems, { keyword: '小熊', status: '进行中' })
  assert.strictEqual(r.length, 1)
  assert.strictEqual(r[0]._id, 'd')
})

test('10. 默认状态过滤：只显示「进行中」，排除「已找到」', () => {
  const r = Core.filterItems(sampleItems, {})
  assert.strictEqual(r.length, 3)
  assert.ok(r.every(it => it.status === '进行中'))
})

test('11. 按类型过滤：只返回「招领」', () => {
  const r = Core.filterItems(sampleItems, { type: '招领', status: '进行中' })
  assert.strictEqual(r.length, 2)
  assert.ok(r.every(it => it.type === '招领'))
})

test('12. 无匹配结果：返回空数组（搜索无结果的异常分支）', () => {
  const r = Core.filterItems(sampleItems, { keyword: '不存在的物品', status: '进行中' })
  assert.strictEqual(r.length, 0)
})

/* ============================================================
 * 三、地点归一化 normPlace / matchPlace
 * ============================================================ */
console.log('【三】地点归一化 normPlace')

test('13. 教学楼A栋 → 归一化为「教学楼」', () => {
  assert.strictEqual(Core.normPlace('教学楼A栋'), '教学楼')
})

test('14. 操场 → 归一化为「体育馆」', () => {
  assert.strictEqual(Core.normPlace('操场'), '体育馆')
})

test('15. matchPlace 能匹配历史脏值写法', () => {
  assert.strictEqual(Core.matchPlace('教学楼A栋', '教学楼'), true)
  assert.strictEqual(Core.matchPlace('饭堂', '食堂'), true)
})

/* ============================================================
 * 四、类别图标解析 resolveCategoryIcon
 * ============================================================ */
console.log('【四】类别图标解析 resolveCategoryIcon')

test('16. 精确匹配：电子产品 → earbuds', () => {
  const r = Core.resolveCategoryIcon('电子产品', '寻物')
  assert.strictEqual(r.key, 'earbuds')
  assert.strictEqual(r.matched, true)
})

test('17. 未知类别：走兜底（寻物 → bag，招领 → wallet）', () => {
  assert.strictEqual(Core.resolveCategoryIcon('未知', '寻物').key, 'bag')
  assert.strictEqual(Core.resolveCategoryIcon('未知', '招领').key, 'wallet')
})

test('18. 空类别：直接兜底，不报错', () => {
  const r = Core.resolveCategoryIcon('', '寻物')
  assert.strictEqual(r.matched, false)
})

/* ============================================================
 * 五、状态机 terminalStatus
 * ============================================================ */
console.log('【五】状态机 terminalStatus')

test('19. 寻物终态是「已找到」，招领终态是「已归还」', () => {
  assert.strictEqual(Core.terminalStatus('寻物'), '已找到')
  assert.strictEqual(Core.terminalStatus('招领'), '已归还')
})

/* ============================================================
 * 汇总
 * ============================================================ */
console.log('\n========== 测试结果汇总 ==========')
console.log('  通过：' + passed + ' 个')
console.log('  失败：' + failed + ' 个')
if (failures.length) {
  console.log('\n失败用例：')
  failures.forEach(f => console.log('  - ' + f.name))
  process.exit(1)
} else {
  console.log('  ✅ 全部通过！')
  process.exit(0)
}
