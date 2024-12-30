export default {
  // 除錯模式
  DEBUG: true,           // 是否顯示除錯資訊

  // 用戶識別模式
  USER_ID_MODE: 'session',  // 'session' | 'IP'

  // 用戶限制
  MAX_CIRCLES_PER_USER: 20,    // 每個用戶最多可以創建的球數量

  // 球體屬性
  CIRCLE_RADIUS: 10,           // 球的半徑
  RANDOM_RADIUS: false,        // 是否啟用隨機半徑
  RANDOM_RADIUS_RANGE: [0.3, 1.1],  // 隨機半徑的範圍倍數
  CIRCLE_MIN_DIST: 50,         // 球之間的最小距離

  // 計算精度
  POSITION_DECIMALS: 2,        // 位置的小數點位數
  VELOCITY_DECIMALS: 2,        // 速度的小數點位數
};
