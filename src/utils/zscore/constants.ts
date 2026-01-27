// WHO Child Growth Standards (0-24 Months Data)
// Simplified Thresholds per Month

// BB/U (Weight-for-age) BOYS
export const BB_U_BOY = {
  // -3SD, -2SD (Median is roughly between, not stored for threshold check)
  minus3SD: [
    2.1, 2.9, 3.8, 4.4, 4.9, 5.3, 5.7, 5.9, 6.2, 6.4, 6.6, 6.8, 6.9, 7.1, 7.2,
    7.4, 7.5, 7.7, 7.8, 8.0, 8.1, 8.2, 8.4, 8.5, 8.6,
  ],
  minus2SD: [
    2.5, 3.4, 4.3, 5.0, 5.6, 6.0, 6.4, 6.7, 6.9, 7.1, 7.4, 7.6, 7.7, 7.9, 8.1,
    8.3, 8.4, 8.6, 8.8, 8.9, 9.1, 9.2, 9.4, 9.5, 9.7,
  ],
};

// BB/U GIRLS
export const BB_U_GIRL = {
  minus3SD: [
    2.0, 2.7, 3.4, 4.0, 4.4, 4.8, 5.1, 5.3, 5.6, 5.8, 5.9, 6.1, 6.3, 6.4, 6.6,
    6.7, 6.9, 7.0, 7.2, 7.3, 7.5, 7.6, 7.8, 7.9, 8.1,
  ],
  minus2SD: [
    2.4, 3.2, 3.9, 4.5, 5.0, 5.4, 5.7, 6.0, 6.3, 6.5, 6.7, 6.9, 7.0, 7.2, 7.4,
    7.6, 7.7, 7.9, 8.1, 8.2, 8.4, 8.6, 8.7, 8.9, 9.0,
  ],
};

// TB/U (Length-for-age) BOYS
export const TB_U_BOY = {
  minus3SD: [
    44.2, 48.9, 52.4, 55.6, 58.7, 61.7, 63.3, 64.8, 66.2, 67.5, 68.7, 69.9,
    71.0, 72.1, 73.1, 74.1, 75.0, 76.0, 76.9, 77.7, 78.6, 79.4, 80.2, 81.0,
    81.7,
  ],
  minus2SD: [
    46.1, 50.8, 54.4, 57.6, 60.0, 61.9, 63.6, 65.1, 66.5, 67.9, 69.2, 70.4,
    71.5, 72.6, 73.7, 74.7, 75.6, 76.5, 77.4, 78.2, 79.1, 79.9, 80.7, 81.6,
    82.3,
  ],
};

// TB/U GIRLS
export const TB_U_GIRL = {
  minus3SD: [
    43.6, 47.8, 51.0, 54.1, 57.0, 59.9, 61.2, 62.7, 64.0, 65.3, 66.5, 67.7,
    68.9, 70.0, 71.0, 72.0, 73.0, 74.0, 74.9, 75.8, 76.7, 77.5, 78.4, 79.2,
    80.0,
  ],
  minus2SD: [
    45.4, 49.8, 53.2, 56.4, 59.0, 60.9, 62.5, 64.1, 65.5, 66.9, 68.2, 69.5,
    70.7, 71.8, 72.9, 73.9, 74.9, 75.8, 76.8, 77.7, 78.6, 79.4, 80.3, 81.1,
    82.0,
  ],
};

// For BB/TB (Weight-for-length), it's complex (Height dependent).
// Providing a very simplified "safe minimum weight derived from height"
// Formula approximation: WeightMin = 2 + 0.1 * Height (very rough, better to rely on BB/U for MVP)
