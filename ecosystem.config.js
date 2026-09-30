module.exports = {
  apps: [
    {
      name: "controle-avarias",
      script: "./server.js",
      instances: 1, // ou 'max' para modo cluster usando todos os núcleos
      autorestart: true,
      watch: false, // Não assista mudanças em produção para não ficar reiniciando à toa
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development",
        PORT: 3009
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3009
      }
    }
  ]
};
