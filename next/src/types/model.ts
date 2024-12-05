// ハムスターが一回転走った時間
export type Run = {
  from: Date;
  to: Date;
  seconds: number;
  speed: number;
};

// 一回分の疾走記録単位
export type Sprint = {
  from: Date;
  to: Date;
  count: number;
  averageSpeed: number;
};

export type Running = {
  totalCount: number;
  from: Date;
  to: Date;
  speed: number;
  seconds: number;
};
