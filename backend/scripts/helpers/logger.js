// Minimal colored logger for migration output.
const c = {
    reset: '\x1b[0m', gray: '\x1b[90m', green: '\x1b[32m', red: '\x1b[31m',
    yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m'
};

const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (color, s) => (supportsColor ? color + s + c.reset : s);

module.exports = {
    step: (msg) => console.log('\n' + paint(c.cyan, paint(c.bold, `Migrating ${msg}...`))),
    success: (msg) => console.log(paint(c.green, `  ✓ ${msg}`)),
    info: (msg) => console.log(paint(c.gray, `    ${msg}`)),
    warn: (msg) => console.log(paint(c.yellow, `  ! ${msg}`)),
    error: (msg) => console.log(paint(c.red, `  ✗ ${msg}`)),
    heading: (msg) => console.log('\n' + paint(c.bold, msg)),
    plain: (msg) => console.log(msg)
};
