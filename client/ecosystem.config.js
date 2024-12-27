module.exports = {
  apps: [
    {
      name: "ham-client",
      script: "python main.py https://ham-server.refty.tech",
      watch: true, // ファイル変更時に自動再起動
      autorestart: true, // 自動再起動を有効化
    },
  ],
};
