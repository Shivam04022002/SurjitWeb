module.exports = {
  apps: [
    {
      name: 'surjit-backend',
      script: 'server.js',
      cwd: '/home/ubuntu/projects/backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
