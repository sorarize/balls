export default {
  // Debug mode
  DEBUG: true,           // Whether to display debug information

  // User identification mode
  USER_ID_MODE: 'session',  // 'session' | 'IP'

  // User limits
  MAX_CIRCLES_PER_USER: 20,    // Maximum number of circles per user

  // Circle properties
  CIRCLE_RADIUS: 10,           // Circle radius
  RANDOM_RADIUS: false,        // Whether to enable random radius
  RANDOM_RADIUS_RANGE: [0.3, 1.1],  // Random radius range multiplier
  CIRCLE_MIN_DIST: 50,         // Minimum distance between circles
  SATURATION: 50,
  LIGHTNESS: 60,

  // Calculation precision
  POSITION_DECIMALS: 2,        // Decimal places for position
  VELOCITY_DECIMALS: 2,        // Decimal places for velocity
};
