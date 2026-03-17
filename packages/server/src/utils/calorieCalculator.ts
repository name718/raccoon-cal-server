// ─── 类型 ────────────────────────────────────────────────────────────────────

export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'extra_active';

export type Goal = 'lose_weight' | 'maintain' | 'gain_muscle';

export interface CalorieCalculatorParams {
  gender: 'male' | 'female';
  weight: number; // kg
  height: number; // cm
  age: number;
  activityLevel: ActivityLevel;
  goal: Goal;
}

// ─── 常量 ────────────────────────────────────────────────────────────────────

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

const GOAL_MULTIPLIERS: Record<Goal, number> = {
  lose_weight: 0.8,
  maintain: 1.0,
  gain_muscle: 1.1,
};

const MIN_CALORIES = 1200;

// ─── 纯函数（无副作用） ───────────────────────────────────────────────────────

/**
 * 使用 Harris-Benedict 公式计算每日卡路里目标（确定性纯函数）。
 *
 * 公式：
 * - 男性 BMR = 88.362 + (13.397 × weight_kg) + (4.799 × height_cm) - (5.677 × age)
 * - 女性 BMR = 447.593 + (9.247 × weight_kg) + (3.098 × height_cm) - (4.330 × age)
 *
 * TDEE = BMR × 活动系数
 * 目标卡路里 = TDEE × 目标系数，最低 1200 kcal
 *
 * @param params 用户健康数据
 * @returns 每日卡路里目标（整数，最低 1200）
 */
export function calcDailyCalorieTarget(
  params: CalorieCalculatorParams
): number {
  const { gender, weight, height, age, activityLevel, goal } = params;

  const bmr =
    gender === 'male'
      ? 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age
      : 447.593 + 9.247 * weight + 3.098 * height - 4.33 * age;

  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel];
  const target = tdee * GOAL_MULTIPLIERS[goal];

  return Math.max(MIN_CALORIES, Math.round(target));
}
