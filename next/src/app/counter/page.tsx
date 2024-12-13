import CounterPage from "./CounterPage";
import { FC } from "react";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { endOfDay, startOfDay } from "date-fns";

/**
 * 現在の日本時間の日付範囲をUTC形式で取得する関数
 * @returns 日本時間の開始時刻と終了時刻をUTCで返す
 */
const getTodayJST2UTC = (today: Date) => {
  const todayJST = toZonedTime(today, "Asia/Tokyo");
  const startOfDayJST = startOfDay(todayJST);
  const endOfDayJST = endOfDay(todayJST);
  const startOfDayUTC = fromZonedTime(startOfDayJST, "Asia/Tokyo");
  const endOfDayUTC = fromZonedTime(endOfDayJST, "Asia/Tokyo");
  return { startOfDayUTC, endOfDayUTC };
};

// APIのエンドポイント
const ENDPOINT = process.env.NEXT_PUBLIC_API_BASE_URL;

const Page: FC = async () => {
  const timestamp = new Date();
  // 現在の日本時間の日付範囲をUTC形式で取得
  const { startOfDayUTC, endOfDayUTC } = getTodayJST2UTC(timestamp);
  const params = {
    from: startOfDayUTC.toISOString(),
    to: endOfDayUTC.toISOString(),
  };

  const query_params = new URLSearchParams(params);
  const res = await fetch(
    `${ENDPOINT}/run?${query_params}&_=${timestamp.getTime()}`,
    {
      cache: "no-store", // キャッシュを無効化
    }
  );

  if (!res.ok) {
    throw new Error("走行データの取得に失敗しました");
  }

  const data: { count: number } = await res.json();

  return <CounterPage totalCount={data.count} />;
};

export default Page;
