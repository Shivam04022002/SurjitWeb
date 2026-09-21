const XLSX = require('xlsx');
const Blog = require('../../models/Blog');
const BlogCategory = require('../../models/BlogCategory');
const zoned = require('../../utils/zonedDate');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');

// Monthly blog plans from Excel.
//
//   parseWorkbook  an uploaded .xlsx/.xls -> plan rows, each validated
//   validateRows   plan rows edited in the CMS -> the same validation
//   buildTemplate  a blank plan with examples and the active categories
//
// Only planning lives here. Generating and saving each row go through the
// existing Gemini generate/image/draft endpoints, unchanged.
//
// The spreadsheet is read in memory and never stored. Formulas are never
// evaluated: a formula cell is reported as an error instead of trusting its
// cached result, and macros are not read at all. Values are validated, not
// rewritten — every row carries what the file said alongside what it means,
// so an invalid cell is shown to the admin exactly as it was entered.

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 100;
const MAX_VALIDATE_ROWS = 200;

const COLUMN_ALIASES = {
    date: ['date', 'create date', 'created date', 'publish date', 'blog date'],
    topic: ['blog topic', 'topic', 'blog name', 'blog name / topic', 'title', 'blog title'],
    category: ['category', 'blog category'],
    image: ['generate image', 'image', 'featured image', 'generate featured image']
};
const COLUMN_LABELS = { date: 'Date', topic: 'Blog Topic', category: 'Category', image: 'Generate Image' };
const REQUIRED_COLUMNS = ['date', 'topic'];

const XLSX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const XLS_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

const pad = (n) => String(n).padStart(2, '0');
const displayDay = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const normHeader = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const normKey = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// ── Value interpretation ──────────────────────────────────────────────────────

// Accepts an Excel date (a serial number from a date cell) or text in
// DD/MM/YYYY (also - or .) or YYYY-MM-DD. Day-first, as dates are written in
// India; anything ambiguous or impossible is an error, never a guess.
const interpretDate = (value) => {
    if (value === null || value === undefined || value === '') return { error: 'Date is required' };

    if (typeof value === 'number') {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (!parsed || !parsed.y) return { error: 'Date is not a valid date' };
        return { iso: `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}` };
    }

    const text = String(value).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
    let iso = null;
    if (m) iso = `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
    if (m) iso = `${m[3]}-${pad(m[2])}-${pad(m[1])}`;

    if (!iso) return { error: `Date "${text.slice(0, 40)}" is not in DD/MM/YYYY format` };
    if (!zoned.isValidDay(iso)) return { error: `Date "${text.slice(0, 40)}" does not exist` };
    return { iso };
};

const YES = ['yes', 'y', 'true', '1'];
const NO = ['no', 'n', 'false', '0'];

const interpretImage = (value) => {
    if (value === null || value === undefined || value === '') return { value: true, defaulted: true };
    if (typeof value === 'boolean') return { value };
    const text = String(value).trim().toLowerCase();
    if (YES.includes(text)) return { value: true };
    if (NO.includes(text)) return { value: false };
    return { error: `Generate Image must be Yes or No, not "${String(value).slice(0, 20)}"` };
};

// ── Validation (shared by upload and edits) ───────────────────────────────────

const loadContext = async () => {
    const [categories, titles] = await Promise.all([
        BlogCategory.find().select('name isActive').lean(),
        Blog.find().select('title').lean()
    ]);
    return {
        categories,
        titles: new Set(titles.map((b) => normKey(b.title)))
    };
};

// `input` holds cell values as entered: date (text or an Excel serial),
// topic, category (a name, or an id from the CMS), generateImage (Yes/No,
// true/false or blank). Each row comes back with its normalised values, the
// original text for display, and its errors and warnings.
const validateRows = async (inputs, context) => {
    const { categories, titles } = context || await loadContext();
    const today = zoned.today();
    const latest = zoned.addDays(today, 365);

    const rows = inputs.map((input, index) => {
        const errors = [];
        const warnings = [];
        const add = (field, message) => errors.push({ field, message });

        const date = interpretDate(input.date);
        if (date.error) add('date', date.error);
        else if (date.iso < '2000-01-01' || date.iso > latest) add('date', 'Date must be between 2000 and one year from today');

        const topic = String(input.topic ?? '').trim();
        if (!topic) add('topic', 'Blog topic is required');
        else if (topic.length < 3 || topic.length > 200) add('topic', 'Blog topic must be 3-200 characters');

        let category = null;
        const categoryText = String(input.category ?? '').trim();
        if (categoryText) {
            const match = categories.find((c) => String(c._id) === categoryText)
                || categories.find((c) => normKey(c.name) === normKey(categoryText));
            if (!match) add('category', `Category "${categoryText.slice(0, 60)}" does not exist. Use an active category or leave it blank.`);
            else if (!match.isActive) add('category', `Category "${match.name}" is inactive`);
            else category = { _id: String(match._id), name: match.name };
        }

        const image = interpretImage(input.generateImage);
        if (image.error) add('generateImage', image.error);

        if (topic && titles.has(normKey(topic))) warnings.push('A blog with this exact title already exists');

        const typedDate = typeof input.date === 'number' ? displayDay(date.iso) : String(input.date ?? '').trim();
        return {
            index,
            sourceRow: input.sourceRow ?? null,
            input: {
                date: typedDate,
                topic,
                category: category ? category.name : categoryText,
                generateImage: typeof input.generateImage === 'boolean'
                    ? (input.generateImage ? 'Yes' : 'No')
                    : String(input.generateImage ?? '').trim()
            },
            date: date.iso && !errors.some((e) => e.field === 'date') ? date.iso : null,
            topic,
            category,
            generateImage: image.error ? null : image.value,
            imageDefaulted: !!image.defaulted,
            errors,
            warnings
        };
    });

    // Duplicates: a later row repeating an earlier topic or date is the one
    // flagged, pointing back at the row it repeats.
    const firstTopic = new Map();
    const firstDate = new Map();
    const label = (r) => (r.sourceRow ? `row ${r.sourceRow}` : `#${r.index + 1}`);
    for (const r of rows) {
        const tk = normKey(r.topic);
        if (tk && r.topic.length >= 3) {
            if (firstTopic.has(tk)) r.errors.push({ field: 'topic', message: `Duplicate topic — same as ${label(firstTopic.get(tk))}` });
            else firstTopic.set(tk, r);
        }
        if (r.date) {
            if (firstDate.has(r.date)) r.errors.push({ field: 'date', message: `Duplicate date — ${label(firstDate.get(r.date))} already uses ${displayDay(r.date)}` });
            else firstDate.set(r.date, r);
        }
    }

    rows.forEach((r) => { r.valid = r.errors.length === 0; });
    const valid = rows.filter((r) => r.valid);
    return {
        rows,
        summary: {
            total: rows.length,
            valid: valid.length,
            invalid: rows.length - valid.length,
            imagesRequested: valid.filter((r) => r.generateImage).length
        }
    };
};

// ── Excel upload ──────────────────────────────────────────────────────────────

const assertSpreadsheet = (file) => {
    if (!file || !file.buffer || !file.buffer.length) {
        throw new AppError('Choose an Excel file (.xlsx or .xls) to upload.', HTTP_STATUS.BAD_REQUEST);
    }
    const name = String(file.originalname || '').toLowerCase();
    const head = file.buffer.subarray(0, 8);
    const isXlsx = name.endsWith('.xlsx') && head.subarray(0, 4).equals(XLSX_MAGIC);
    const isXls = name.endsWith('.xls') && head.equals(XLS_MAGIC);
    if (!isXlsx && !isXls) {
        throw new AppError('The file is not a valid Excel workbook. Upload an .xlsx or .xls file.', HTTP_STATUS.BAD_REQUEST);
    }
};

const readWorkbook = (buffer) => {
    try {
        return XLSX.read(buffer, {
            type: 'buffer',
            cellFormula: true, // read so that formula cells can be refused
            cellHTML: false,
            cellNF: false,
            cellStyles: false,
            cellDates: false,
            bookVBA: false,
            // Stops reading far past the row limit, whatever the file claims.
            sheetRows: MAX_ROWS + 200
        });
    } catch {
        throw new AppError('The Excel file could not be read. It may be damaged or password-protected.', HTTP_STATUS.BAD_REQUEST);
    }
};

const cellInput = (cell) => {
    if (!cell) return { value: null };
    if (cell.f) return { value: null, formula: true };
    if (cell.t === 'n' || cell.t === 'b') return { value: cell.v };
    if (cell.t === 'e') return { value: null, invalid: true };
    return { value: cell.v === undefined || cell.v === null ? null : String(cell.v) };
};

const parseWorkbook = async (file) => {
    assertSpreadsheet(file);
    const wb = readWorkbook(file.buffer);
    const sheet = wb.SheetNames.length ? wb.Sheets[wb.SheetNames[0]] : null;
    if (!sheet || !sheet['!ref']) {
        throw new AppError('The first sheet of the workbook is empty.', HTTP_STATUS.BAD_REQUEST);
    }

    const range = XLSX.utils.decode_range(sheet['!ref']);
    const at = (r, c) => sheet[XLSX.utils.encode_cell({ r, c })];

    // The header is the first row with any text in it.
    let headerRow = -1;
    for (let r = range.s.r; r <= range.e.r && headerRow < 0; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
            if (String(at(r, c)?.v ?? '').trim()) { headerRow = r; break; }
        }
    }
    if (headerRow < 0) throw new AppError('No header row was found in the first sheet.', HTTP_STATUS.BAD_REQUEST);

    const columns = {};
    const ignored = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
        const header = normHeader(at(headerRow, c)?.v);
        if (!header) continue;
        const key = Object.keys(COLUMN_ALIASES).find((k) => COLUMN_ALIASES[k].includes(header));
        if (key && columns[key] === undefined) columns[key] = c;
        else ignored.push(String(at(headerRow, c).v).slice(0, 40));
    }
    const missing = REQUIRED_COLUMNS.filter((k) => columns[k] === undefined);
    if (missing.length) {
        throw new AppError(
            `Missing required column${missing.length > 1 ? 's' : ''}: ${missing.map((k) => COLUMN_LABELS[k]).join(', ')}. `
            + 'Expected columns: Date | Blog Topic | Category | Generate Image. Download the template for the exact layout.',
            HTTP_STATUS.BAD_REQUEST
        );
    }

    const inputs = [];
    const cellErrors = [];
    for (let r = headerRow + 1; r <= range.e.r; r++) {
        const cells = {};
        const problems = [];
        let blank = true;
        for (const key of Object.keys(COLUMN_ALIASES)) {
            if (columns[key] === undefined) { cells[key] = { value: null }; continue; }
            const cell = cellInput(at(r, columns[key]));
            cells[key] = cell;
            if (cell.formula) problems.push({ field: key === 'image' ? 'generateImage' : key, message: `${COLUMN_LABELS[key]} contains a formula. Enter the value itself.` });
            if (cell.invalid) problems.push({ field: key === 'image' ? 'generateImage' : key, message: `${COLUMN_LABELS[key]} contains an Excel error value.` });
            if (cell.formula || cell.invalid || (cell.value !== null && String(cell.value).trim() !== '')) blank = false;
        }
        if (blank) continue;
        if (inputs.length >= MAX_ROWS) {
            throw new AppError(`The file has more than ${MAX_ROWS} blog rows. Split the plan into smaller files.`, HTTP_STATUS.BAD_REQUEST);
        }
        inputs.push({
            sourceRow: r + 1,
            date: cells.date.value,
            topic: cells.topic.value,
            category: cells.category.value,
            generateImage: cells.image.value
        });
        cellErrors.push(problems);
    }
    if (!inputs.length) throw new AppError('No blog rows were found below the header.', HTTP_STATUS.BAD_REQUEST);

    const result = await validateRows(inputs);
    // A formula or error cell is reported as such, rather than as the
    // "required" error its missing value would otherwise produce.
    result.rows.forEach((row, i) => {
        if (!cellErrors[i].length) return;
        const fields = new Set(cellErrors[i].map((e) => e.field));
        row.errors = [...cellErrors[i], ...row.errors.filter((e) => !fields.has(e.field))];
        row.valid = false;
    });
    const validRows = result.rows.filter((r) => r.valid);
    result.summary = {
        total: result.rows.length,
        valid: validRows.length,
        invalid: result.rows.length - validRows.length,
        imagesRequested: validRows.filter((r) => r.generateImage).length
    };
    result.file = {
        name: String(file.originalname).slice(0, 120),
        sheet: wb.SheetNames[0],
        columns: Object.keys(columns).map((k) => COLUMN_LABELS[k]),
        ignoredColumns: ignored
    };
    return result;
};

// ── Template ──────────────────────────────────────────────────────────────────

const buildTemplate = async () => {
    const categories = await BlogCategory.find({ isActive: true }).sort({ displayOrder: 1, name: 1 }).select('name').lean();
    const names = categories.map((c) => c.name);
    const [y, m] = zoned.today().split('-').map(Number);
    const ny = m === 12 ? y + 1 : y;
    const nm = m === 12 ? 1 : m + 1;
    const day = (d) => `${pad(d)}/${pad(nm)}/${ny}`;

    const plan = [
        ['Date', 'Blog Topic', 'Category', 'Generate Image'],
        [day(3), 'How to choose the right vehicle loan', names[0] || '', 'Yes'],
        [day(10), 'Understanding loan repayment schedules', names[1] || names[0] || '', 'Yes'],
        [day(17), 'Simple ways to improve your credit score', '', 'No']
    ];
    const planSheet = XLSX.utils.aoa_to_sheet(plan);
    planSheet['!cols'] = [{ wch: 14 }, { wch: 50 }, { wch: 24 }, { wch: 16 }];
    // Dates are written as text so every spreadsheet app keeps DD/MM/YYYY.
    for (let r = 1; r < plan.length; r++) planSheet[XLSX.utils.encode_cell({ r, c: 0 })].t = 's';

    const categorySheet = XLSX.utils.aoa_to_sheet([['Active categories'], ...names.map((n) => [n])]);
    categorySheet['!cols'] = [{ wch: 32 }];

    const help = XLSX.utils.aoa_to_sheet([
        ['How to fill in the blog plan'],
        ['Date — required. DD/MM/YYYY, e.g. 21/09/2026. One blog per date.'],
        ['Blog Topic — required. 3 to 200 characters. Each topic once.'],
        ['Category — optional. Must match a name on the Categories sheet exactly; leave blank to let Gemini choose.'],
        ['Generate Image — Yes or No. Blank means Yes.'],
        [`At most ${MAX_ROWS} rows per file. Only the first sheet is read. Formulas are not accepted.`],
        ['Uploading only creates a plan to review. Nothing is generated until you click Generate All, and every blog is saved as a draft.']
    ]);
    help['!cols'] = [{ wch: 110 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, planSheet, 'Blog Plan');
    XLSX.utils.book_append_sheet(wb, categorySheet, 'Categories');
    XLSX.utils.book_append_sheet(wb, help, 'Instructions');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = {
    parseWorkbook, validateRows, buildTemplate,
    MAX_FILE_BYTES, MAX_ROWS, MAX_VALIDATE_ROWS,
    _interpretDate: interpretDate
};
