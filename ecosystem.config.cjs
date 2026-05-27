// PM2 ecosystem for Frontier Intel Cache.
// Run from project root: pm2 start ecosystem.config.cjs
//
// IMPORTANT: all paths are absolute. Per the standing PM2 hygiene rule,
// relative paths break after `pm2 resurrect` on reboot.

const PROJECT_ROOT = "/mnt/c/Github/frontier-intel-cache";

module.exports = {
  apps: [
    // -------- Backend: FastAPI + indexer --------
    {
      name: "frontier-backend",
      cwd: PROJECT_ROOT + "/backend",
      script: PROJECT_ROOT + "/backend/venv/bin/python",
      args: "main.py",
      interpreter: "none",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "30s",
      max_memory_restart: "500M",
      env: {
        PYTHONUNBUFFERED: "1",
      },
      out_file: PROJECT_ROOT + "/logs/backend.out.log",
      error_file: PROJECT_ROOT + "/logs/backend.err.log",
      time: true,
    },

    // -------- Frontend: Vite preview (serves dist/ on :5173) --------
    {
      name: "frontier-frontend",
      cwd: PROJECT_ROOT + "/frontend",
      script: "npm",
      args: "run preview -- --host 0.0.0.0 --port 5173 --strictPort",
      interpreter: "none",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "30s",
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
      out_file: PROJECT_ROOT + "/logs/frontend.out.log",
      error_file: PROJECT_ROOT + "/logs/frontend.err.log",
      time: true,
    },
  ],
};
