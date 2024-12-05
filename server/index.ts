import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { MongoClient } from "mongodb";
import { Run, Running, RunSchema, Sprint, SprintSchema } from "./models";
import cors from "cors";
import { endOfDay, startOfDay } from "date-fns";

// express server
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
// http server
const httpServer = createServer(app);
// socket server
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// mongo client
const uri = "mongodb://mongodb:27017";
const client = new MongoClient(uri);
const database = client.db("ham-counter");
const run = database.collection<Run>("run");
const sprint = database.collection<Sprint>("sprint");

// root path
app.get("/", (req: express.Request, res: express.Response) => {
  res.json({
    message: "root path",
  });
});

// 一回分の走りを記録するエンドポイント
app.post("/run", async (req: express.Request, res: express.Response) => {
  // リクエストボディをパース
  const reqData = {
    from: new Date(req.body.from),
    to: new Date(req.body.to),
    seconds: req.body.seconds,
    speed: req.body.speed,
  };
  // パース結果をチェック
  const { success, error, data } = RunSchema.safeParse(reqData);

  // パースに失敗した場合は400を返す
  if (success) {
    // パースに成功した場合はデータを挿入
    await run.insertOne(data);
    res.status(201).json(data);
  } else {
    res.status(400).json(error);
  }
});

// 一回分の疾走を記録するエンドポイント
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

// socket server
io.on("connection", (socket) => {
  console.log("connected");

  const changeStream = run.watch();

  // 変更があったかどうか
  let isChange = false;
  // データベースの変更を監視
  changeStream.on("change", async (next) => {
    if (next.operationType === "insert") {
      // 挿入されたレコードを取得
      const record = next.fullDocument;

      // 本日の日付を取得
      const today = new Date();
      // データベース内の本日分レコードの総数を取得
      const totalCount = await run.countDocuments({
        from: { $gte: startOfDay(today), $lte: endOfDay(today) },
      });

      // レスポンス用のデータを作成
      const res: Running = {
        totalCount,
        from: record.from,
        to: record.to,
        speed: record.speed,
        seconds: record.seconds,
      };
      // データを送信
      socket.emit("receiveMessage", res);

      // 変更があったことをフラグに設定
      isChange = true;
    }
  });

  // メッセージを受け取る
  socket.on("message", (message) => {
    console.log(`message: ${message}`);
    socket.emit("receiveMessage", message);
  });

  setInterval(async () => {
    // 1.5秒以上変更がない場合はレスポンスを送信
    if (!isChange) {
      // 本日の日付を取得
      const today = new Date();
      // データベース内の本日分レコードの総数を取得
      const totalCount = await run.countDocuments({
        from: { $gte: startOfDay(today), $lte: endOfDay(today) },
      });
      // レスポンス用のデータを作成
      const res: Running = {
        totalCount,
        from: today,
        to: today,
        speed: 0,
        seconds: 0,
      };
      // データを送信
      socket.emit("receiveMessage", res);
    } else {
      // 変更があった場合は、フラグをリセット
      isChange = false;
    }
  }, 1500);

  // 接続が切れたとき
  socket.on("close", () => {
    console.log("closing");
    changeStream.close();
  });
});

// http server
httpServer.listen(8000, () => {
  console.log("Chat server listening on port 8000");
});

// close listener
httpServer.on("close", () => {
  console.log("closing");
  client.close();
});
