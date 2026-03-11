module.exports = {
  apps: [{
    name: 'godsend',
    script: 'src/app.js',
    cwd: '/home/godsend/godsend-cms',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_file: '.env',
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true
  }]
};
