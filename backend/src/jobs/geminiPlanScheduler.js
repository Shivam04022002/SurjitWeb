// The timer behind scheduled blog generation.
//
// A plan names a day, not a time, so this does not need to fire at a particular
// moment — it needs to have fired at least once by the end of the day. It wakes
// every fifteen minutes and asks the plan what is due; on a day with nothing
// scheduled that is one indexed query and nothing else.
//
// Deliberately no cron dependency. The cadence is "often enough that a day is
// never missed", which a plain interval states more honestly than a cron
// expression would, and one less package is one less thing to keep patched.
//
// Restarts are cheap: the first run happens shortly after boot, so a deployment
// during the day picks up anything the previous process had not reached. What
// makes that safe is not this file but the row claim and the draft key — this
// only decides how often to ask.

const scheduler = require('../services/gemini/planScheduler.service');
const logger = require('../utils/logger');

const EVERY_MS = 15 * 60 * 1000;

// Long enough for the server to be listening and the database warm, short
// enough that a restart mid-morning still generates that morning's blogs.
const FIRST_RUN_DELAY_MS = 60 * 1000;

let timer = null;
// One run at a time in this process. Overlapping runs would still be safe — the
// claim sees to that — but a slow Gemini call should not stack up work.
let running = false;

const tick = async (reason) => {
    if (running) {
        logger.warn('Scheduled blog generation skipped: the previous run is still going');
        return null;
    }
    running = true;
    try {
        return await scheduler.runDueRows({ reason });
    } catch (err) {
        // A failure here is the run itself falling over, not a blog failing;
        // either way the next tick tries again.
        logger.error('Scheduled blog generation run failed', { reason: err.message });
        return null;
    } finally {
        running = false;
    }
};

const start = () => {
    if (timer) return timer;

    const first = setTimeout(() => tick('startup'), FIRST_RUN_DELAY_MS);
    first.unref?.();

    timer = setInterval(() => tick('timer'), EVERY_MS);
    // Never a reason to hold the process open: if nothing else is running,
    // there is nothing to generate for.
    timer.unref?.();

    logger.info('Gemini plan scheduler started', { everyMinutes: EVERY_MS / 60000 });
    return timer;
};

const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
};

module.exports = { start, stop, tick, EVERY_MS };
