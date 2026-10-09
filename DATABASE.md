# 云开发数据库设计

在微信开发者工具「云开发 → 数据库」中手动创建以下 4 个集合，并粘贴对应的安全规则。
集合名、字段与设计文档第 8 章一一对应。

---

## 1. users（用户表）
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| _openid | string | 微信 openid（自动） |
| nickname | string | 昵称 |
| realName | string | 真实姓名 |
| studentId | string | 学号 |
| college | string | 学院/班级 |
| phone | string | 手机号 |
| cardImage | string | 校园卡照片 fileID |
| authStatus | string | 未认证/审核中/已认证/已驳回 |
| authReason | string | 驳回原因 |
| role | string | 学生/管理员 |
| status | string | 正常/禁用 |
| createTime | string | 注册时间 |

安全规则（仅本人可读写，管理员全读写）：
```json
{
  "read": "doc._openid == auth.openid || get('database.users.${auth.openid}').role == '管理员'",
  "write": "doc._openid == auth.openid || get('database.users.${auth.openid}').role == '管理员'"
}
```

## 2. items（信息表）
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| _openid | string | 发布者 openid（自动） |
| type | string | 寻物/招领 |
| title | string | 物品名称 |
| description | string | 描述 |
| place | string | 地点 |
| time | string | 丢失/捡到时间 |
| contact | string | 联系方式 |
| images | array | 图片 fileID（最多 3） |
| status | string | 待审核/已通过/已驳回/已下架/已完成 |
| auditReason | string | 驳回原因 |
| publisherId | string | 发布者 id |
| createTime | string | 发布时间 |

安全规则（所有人可读；本人或管理员可写）：
```json
{
  "read": true,
  "write": "doc._openid == auth.openid || get('database.users.${auth.openid}').role == '管理员'"
}
```

## 3. reports（举报表）
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| _openid | string | 举报人 openid（自动） |
| itemId | string | 被举报信息 id |
| reporterId | string | 举报人 id |
| reason | string | 举报原因 |
| status | string | 待处理/已处理 |
| createTime | string | 举报时间 |

安全规则：
```json
{
  "read": "doc._openid == auth.openid || get('database.users.${auth.openid}').role == '管理员'",
  "write": "doc._openid == auth.openid || get('database.users.${auth.openid}').role == '管理员'"
}
```

## 4. places（地点表）
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| name | string | 地点名称 |
| createTime | string | 创建时间 |

安全规则（读公开，写仅管理员）：
```json
{
  "read": true,
  "write": "get('database.users.${auth.openid}').role == '管理员'"
}
```

---

## 初始数据
首次使用可在控制台手动录入一条地点数据，或直接用 Mini Program 后台「地点管理」新增。
示例地点：`教学楼 / 宿舍 / 食堂 / 图书馆 / 运动场 / 其他`。
