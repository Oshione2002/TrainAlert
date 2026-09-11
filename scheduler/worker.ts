interface Env { APP_URL: string; INTERNAL_POLL_SECRET: string }

const scheduler = {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(fetch(`${env.APP_URL.replace(/\/$/, "")}/api/internal/poll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.INTERNAL_POLL_SECRET}` },
    }).then((response) => {
      if (!response.ok) throw new Error(`TrainAlert poll returned ${response.status}`);
    }));
  },
};

export default scheduler;
