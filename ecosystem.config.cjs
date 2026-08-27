module.exports = {
  apps: [
    {
      name: "SUBBY-VIRTUAL",
      cwd: __dirname,
      script: "dist/index.js",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      merge_logs: true,
      time: true,
      kill_timeout: 10000,
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "3003",
      },
    },
  ],
};
