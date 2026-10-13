// The timer behind loan-application email retries.
//
// Each email is first sent straight after its application is saved; this only
// picks up what that did not finish — a retry that has come due, or a record
// queued just before a restart. Like the Gemini plan scheduler it is a plain
// interval, and what makes overlapping or repeated runs safe is not this file
// but the record claim in loanNotification.service.

const notifications = require('../services/email/loanNotification.service');
const logger = require('../utils/logger');

const EVERY_MS = 60 * 1000;
const FIRST_RUN_DELAY_MS = 30 * 1000;

let timer = null;
let running = false;

const tick = async () => {
    if (running) return null;
    running = true;
    try {
        return await notifications.sweep();
    } catch (err) {
        logger.error('Loan application email sweep failed', { name: err?.name });
        return null;
    } finally {
        running = false;
    }
};

const start = () => {
    if (timer) return timer;
    const first = setTimeout(tick, FIRST_RUN_DELAY_MS);
    first.unref?.();
    timer = setInterval(tick, EVERY_MS);
    timer.unref?.();
    logger.info('Loan application email scheduler started', { everySeconds: EVERY_MS / 1000 });
    return timer;
};

const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
};

module.exports = { start, stop, tick, EVERY_MS };
