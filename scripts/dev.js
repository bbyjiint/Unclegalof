const { spawn } = require("node:child_process");

const isWindows = process.platform === "win32";

function runWorkspaceDev(workspace) {
  if (isWindows) {
    // Avoid spawn EINVAL for npm.cmd on recent Node; avoid shell:true + args deprecation.
    const comspec = process.env.ComSpec || "cmd.exe";
    return spawn(comspec, ["/d", "/c", `npm run dev --workspace ${workspace}`], {
      stdio: "inherit",
    });
  }
  return spawn("npm", ["run", "dev", "--workspace", workspace], {
    stdio: "inherit",
  });
}

const children = [runWorkspaceDev("client"), runWorkspaceDev("server")];

function stopChildren() {
  for (const child of children) {
    if (!child || child.killed) {
      continue;
    }

    if (isWindows) {
      spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
      });
    } else {
      child.kill("SIGTERM");
    }
  }
}

process.on("SIGINT", () => {
  stopChildren();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopChildren();
  process.exit(0);
});

for (const child of children) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }

    stopChildren();
  });
}
