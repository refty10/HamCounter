"use client";

import { Running } from "@/types/model";
import { FC, useEffect, useState } from "react";

import socketIOClient from "socket.io-client";
const ENDPOINT = process.env.NEXT_PUBLIC_API_BASE_URL;

type Props = {
  /**
   * 走行回数
   */
  totalCount: number;
};

const CounterPage: FC<Props> = ({ totalCount }) => {
  // 走行データ
  const [data, setData] = useState<Running>({
    totalCount,
    from: new Date("2024-01-01"),
    to: new Date("2024-01-01"),
    speed: 0,
    seconds: 0,
  });

  // WebSocket接続
  useEffect(() => {
    const socket = socketIOClient(ENDPOINT);
    // メッセージ受信
    socket.on("receiveMessage", (res: Running) => {
      setData(res);
    });
    // WebSocket切断
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="grid place-content-center min-w-screen min-h-screen">
      <div className="grid gap-4 place-items-center">
        {ENDPOINT}
        <p className="text-2xl">{data.totalCount} 回</p>
        <p className="text-2xl">{data.speed.toPrecision(3)} km/h</p>
        <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
};

export default CounterPage;
