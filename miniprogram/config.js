/**
 * 全局配置
 * ------------------------------------------------------------------
 * 运行模式：
 *   useMock = true  → 使用内置 Mock 数据，微信开发者工具直接预览，无需任何云环境/账号
 *   useMock = false → 连接微信云开发（需填写 env，并部署 cloudfunctions/login）
 *
 * 上线步骤：
 *   1. 在微信公众平台拿到小程序的真实 AppID，替换 project.config.json 里的 appid
 *   2. 在开发者工具「云开发」中开通环境，复制环境 ID 填到下方 env
 *   3. 右键 cloudfunctions/login → 上传并部署（云端安装依赖）
 *   4. 在云开发控制台创建集合 users / items / reports（见 README）
 *   5. 把管理员 openid 加入 adminOpenids（或先在云数据库手动把某 user 的 role 改为 'admin'）
 *   6. 将 useMock 改为 false
 */
module.exports = {
  // 云开发环境 ID（useMock=false 时必填）
  env: 'cloud1-d3g0c773s4025f962',

  // 是否使用 Mock 数据（true 可直接预览；false 走云开发）
  useMock: false,

  // 管理员 openid 白名单（云模式下拥有后台权限）
  // 获取方式：登录后调用 api.getOpenid()，或在云函数日志中查看
  adminOpenids: ['oAk5t3Ze6mSFUcIsHTAO2fZL7C88'],

  // 信息状态枚举
  ITEM_STATUS: ['待审核', '已通过', '已驳回', '已下架', '已完成'],
  // 认证状态枚举
  AUTH_STATUS: ['未认证', '审核中', '已认证', '已驳回'],
  // 信息类型
  ITEM_TYPE: ['寻物', '招领']
}
