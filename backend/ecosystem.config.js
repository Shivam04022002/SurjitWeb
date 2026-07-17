// cwd is resolved from this file's own location, so the app runs from any
// clone path without edits.
module.exports = {
  apps: [
    {
      name: 'surjit-backend',
      script: 'server.js',
      cwd: __dirname,
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
