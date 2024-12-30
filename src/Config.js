export const Config = {
  // 用戶識別模式
  USER_ID_MODE: 'session',  // 'session' | 'IP'

  // 用戶限制
  MAX_CIRCLES_PER_USER: 50,    // 每個用戶最多可以創建的球數量

  // 球體屬性
  CIRCLE_RADIUS: 10,           // 球的半徑
  CIRCLE_MIN_DIST: 50,         // 球之間的最小距離
  REPULSION_FORCE: 0.5,        // 排斥力大小
  FRICTION: 0.95,              // 摩擦係數

  // 顏色設定
  DEFAULT_SATURATION: 70,      // 預設飽和度
  DEFAULT_LIGHTNESS: 50,       // 預設亮度

  // 計算精度
  POSITION_DECIMALS: 2,        // 位置的小數點位數
  VELOCITY_DECIMALS: 2,        // 速度的小數點位數
};
