/* eslint-disable no-console */
export default (...args) => {
  const stack = new Error().stack;
  // 解析堆疊來獲取調用者資訊
  // stack.split('\n')[2] 是因為：
  // [0] 是 "Error"
  // [1] 是當前函數 (xx)
  // [2] 是調用者
  const caller = stack.split('\n')[2]
    .trim()
    .replace(/^at /, '')  // 移除 "at " 前綴
    .split(' ')[0];       // 只取函數名稱部分

  console.log(`[${caller}]`, ...args);
};
