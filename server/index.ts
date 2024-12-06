// 必要なモジュールのインポート
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { MongoClient } from "mongodb";
import { Run, Running, RunSchema, Sprint, SprintSchema } from "./models";
import cors from "cors";
import { endOfDay, startOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const LINE_URL = "https://api.line.me/v2/bot/message/broadcast";

console.log("LINE_ACCESS_TOKEN:", process.env.LINE_ACCESS_TOKEN);

/**
 * データベース接続の設定を行う関数
 * @returns データベースクライアントとコレクションへの参照を含むオブジェクト
 */
const setupDatabase = () => {
  const uri = "mongodb://mongodb:27017";
  const client = new MongoClient(uri);
  const database = client.db("ham-counter");
  return {
    client,
    run: database.collection<Run>("run"),
    sprint: database.collection<Sprint>("sprint"),
  };
};

/**
 * Express サーバーと Socket.IO の設定を行う関数
 * @returns Express アプリ、HTTPサーバー、Socket.IOサーバーを含むオブジェクト
 */
const setupServer = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors());

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  return { app, httpServer, io };
};

/**
 * 現在の日本時間の日付範囲をUTC形式で取得する関数
 * @returns 日本時間の開始時刻と終了時刻をUTCで返す
 */
const getTodayJST2UTC = () => {
  const today = new Date();
  const todayJST = toZonedTime(today, "Asia/Tokyo");
  const startOfDayJST = startOfDay(todayJST);
  const endOfDayJST = endOfDay(todayJST);
  const startOfDayUTC = fromZonedTime(startOfDayJST, "Asia/Tokyo");
  const endOfDayUTC = fromZonedTime(endOfDayJST, "Asia/Tokyo");
  return { startOfDayUTC, endOfDayUTC };
};

/**
 * アプリケーションのメイン処理
 * データベース接続、サーバー設定、ルーティング、WebSocket処理を行う
 */
const main = () => {
  // データベースとサーバーの初期設定
  const { client, run, sprint } = setupDatabase();
  const { app, httpServer, io } = setupServer();

  // データベースの変更を監視し、新しい記録が追加されたら通知
  const changeStream = run.watch();
  changeStream.on("change", async (next) => {
    if (next.operationType === "insert") {
      // 一つ前の走行記録を取得
      const latestRun = await run.findOne({}, { sort: { to: -1 }, skip: 1 });
      if (latestRun) {
        const now = new Date();
        const diffMinutes =
          (now.getTime() - latestRun.to.getTime()) / (1000 * 60);
        if (diffMinutes >= 10) {
          // 10分以上走行記録がない場合にLINEにメッセージを送信
          const payload = {
            messages: [
              {
                type: "text",
                text: "ハムが走っています！！\n ハムの様子を見に行きましょう！\nhttps://ham.refty.tech/counter",
              },
            ],
          };
          // LINE_ACCESS_TOKENが設定されている場合にメッセージを送信
          if (LINE_ACCESS_TOKEN) {
            await fetch(LINE_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
              },
              body: JSON.stringify(payload),
            });
          }
        }
      }
    }
  });

  // ルートエンドポイント
  app.get("/", (req: express.Request, res: express.Response) => {
    res.json({ message: "root path" });
  });

  /**
   * 指定期間の走行回数を取得するエンドポイント
   * クエリパラメータ: from, to (日付文字列)
   */
  app.get("/run", async (req: express.Request, res: express.Response) => {
    const from = new Date(req.query.from as string);
    const to = new Date(req.query.to as string);
    const count = await run.countDocuments({
      from: { $gte: from, $lte: to },
    });
    res.json({ count });
  });

  /**
   * 新しい走行記録を保存するエンドポイント
   * 必要なデータ: from, to, seconds, speed
   */
  app.post("/run", async (req: express.Request, res: express.Response) => {
    const reqData = {
      from: new Date(req.body.from),
      to: new Date(req.body.to),
      seconds: req.body.seconds,
      speed: req.body.speed,
    };
    const { success, error, data } = RunSchema.safeParse(reqData);

    if (success) {
      await run.insertOne(data);
      res.status(201).json(data);
    } else {
      res.status(400).json(error);
    }
  });

  /**
   * 新しい疾走記録を保存するエンドポイント
   * 必要なデータ: from, to, counts, averageSpeed
   */
  app.post("/sprint", async (req: express.Request, res: express.Response) => {
    const reqData = {
      from: new Date(req.body.from),
      to: new Date(req.body.to),
      counts: req.body.count,
      averageSpeed: req.body.averageSpeed,
    };
    const { success, error, data } = SprintSchema.safeParse(reqData);
    if (success) {
      await sprint.insertOne(data);
      res.status(201).json(data);
    } else {
      res.status(400).json(error);
    }
  });

  // WebSocketによるリアルタイム通信の処理
  io.on("connection", (socket) => {
    console.log("connected");
    const changeStream = run.watch();
    // データベースの変更があったかどうかのフラグ
    let isChange = false;

    // データベースの変更を監視し、新しい記録が追加されたら通知
    changeStream.on("change", async (next) => {
      if (next.operationType === "insert") {
        const record = next.fullDocument;
        const { startOfDayUTC, endOfDayUTC } = getTodayJST2UTC();

        const totalCount = await run.countDocuments({
          from: { $gte: startOfDayUTC, $lte: endOfDayUTC },
        });

        const res: Running = {
          totalCount,
          from: record.from,
          to: record.to,
          speed: record.speed,
          seconds: record.seconds,
        };
        socket.emit("receiveMessage", res);
        isChange = true;
      }
    });

    // クライアントからのメッセージを処理
    socket.on("message", (message) => {
      console.log(`message: ${message}`);
      socket.emit("receiveMessage", message);
    });

    // 定期的な状態更新（1.5秒ごと）
    setInterval(async () => {
      if (!isChange) {
        const { startOfDayUTC, endOfDayUTC } = getTodayJST2UTC();
        const totalCount = await run.countDocuments({
          from: { $gte: startOfDayUTC, $lte: endOfDayUTC },
        });
        const res: Running = {
          totalCount,
          from: new Date(),
          to: new Date(),
          speed: 0,
          seconds: 0,
        };
        socket.emit("receiveMessage", res);
      } else {
        isChange = false;
      }
    }, 1500);

    // WebSocket接続終了時の処理
    socket.on("close", () => {
      console.log("closing");
      changeStream.close();
    });
  });

  // サーバーの起動
  httpServer.listen(8000, () => {
    console.log("Server Listening On Port 8000");
  });

  // サーバー終了時の処理
  httpServer.on("close", () => {
    console.log("Server Closing");
    client.close();
  });
};

// アプリケーションの実行
main();
