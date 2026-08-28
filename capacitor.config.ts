import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor 配置
 *
 * 分发策略（零年费 / 零上架费）：
 * - Android：构建 APK 后直接侧载安装，无需上架 Google Play
 * - iOS：受限于中国区侧载政策，建议以 PWA（添加到主屏幕）形态使用；
 *        若要原生 App 需 ¥688/年的 App Store 账号或企业号
 * - 桌面：构建产物即静态站点，可直接部署或本地打开
 */
const config: CapacitorConfig = {
  appId: 'com.petpal.app',
  appName: 'PetPal',
  webDir: 'dist',
}

export default config
