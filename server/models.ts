import { z } from "zod";

// ハムスターが一回転走った時間と速度
export const RunSchema = z.object({
  from: z.date(),
  to: z.date(),
  seconds: z.number(),
  speed: z.number(),
});
export type Run = z.infer<typeof RunSchema>;

// 一回分の疾走記録単位
export const SprintSchema = z.object({
  from: z.date(),
  to: z.date(),
  counts: z.number(),
  averageSpeed: z.number(),
});
export type Sprint = z.infer<typeof SprintSchema>;

export type Running = {
  totalCount: number;
  from: Date;
  to: Date;
  speed: number;
  seconds: number;
};
