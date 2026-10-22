module.exports = {
  apps: [
    {
      name: "agente-chamados",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "server.ts",
      cwd: "C:/projetos/Agente-de-Chamados",
      autorestart: true,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};