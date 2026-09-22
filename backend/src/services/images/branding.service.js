const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');
const { AppError } = require('../../middleware/errorHandler');
const HTTP_STATUS = require('../../constants/httpStatus');

// Puts the real Surjit Finance logo on a featured image.
//
// The logo is the website's own PNG (frontend/src/assets/logo-4-2048x319.png),
// kept byte-for-byte in backend/src/assets/brand so the server never depends
// on the frontend build. It is composited as-is — never redrawn, recoloured
// or distorted — with its transparency, scaled to about 14% of the image
// width, top-right, the same small margin (3.5% of the width) from the top
// and right edges. The logo is dark, so over
// a dark or busy area it gets a soft white backing plate (the logo itself is
// untouched).
//
// Pure JavaScript (pngjs, jpeg-js): no native binaries to build on the
// server. The result is a JPEG, sized for the web.

const LOGO_PATH = path.join(__dirname, '..', '..', 'assets', 'brand', 'surjit-finance-logo.png');

const OUTPUT_MAX_WIDTH = 1536;
const MIN_WIDTH = 640;
const MIN_HEIGHT = 300;
const MAX_SIDE = 8192;
const MIN_LANDSCAPE = 1.25;         // narrower images are centre-cropped to 16:9
const LOGO_WIDTH_SHARE = 0.14;
// One margin, in pixels, for both the top and the right edge.
const MARGIN_SHARE = 0.035;
const PLATE_ALPHA = 0.88;
const JPEG_QUALITY = 92;

const unreadable = (why) => new AppError(`The featured image could not be branded: ${why}. Upload an image instead.`, HTTP_STATUS.BAD_GATEWAY);

// The format comes from the bytes, not from what the sender claims.
const sniff = (buf) => {
    if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47) return 'png';
    if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
    if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
    return null;
};

// → { width, height, data: RGBA Buffer }
const decode = (buf) => {
    const kind = sniff(buf);
    let img;
    try {
        if (kind === 'png') img = PNG.sync.read(buf);
        else if (kind === 'jpeg') img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 70, maxMemoryUsageInMB: 512 });
    } catch {
        throw unreadable('the image data is damaged');
    }
    if (kind === 'webp') throw unreadable('WebP images are not supported');
    if (!img) throw unreadable('it is not a PNG or JPEG image');
    const { width, height } = img;
    if (width > MAX_SIDE || height > MAX_SIDE) throw unreadable(`it is too large (${width}×${height})`);
    if (width < MIN_WIDTH || height < MIN_HEIGHT) throw unreadable(`it is too small (${width}×${height})`);
    return { width, height, data: Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length) };
};

// Area-average downscale with premultiplied alpha, so transparent edges of
// the logo do not darken. Only ever used to shrink (dw ≤ sw, dh ≤ sh).
const resize = (src, sw, sh, dw, dh) => {
    const out = Buffer.alloc(dw * dh * 4);
    const xr = sw / dw;
    const yr = sh / dh;
    for (let dy = 0; dy < dh; dy++) {
        const y0 = dy * yr;
        const y1 = y0 + yr;
        for (let dx = 0; dx < dw; dx++) {
            const x0 = dx * xr;
            const x1 = x0 + xr;
            let r = 0; let g = 0; let b = 0; let a = 0; let area = 0;
            for (let sy = Math.floor(y0); sy < Math.min(sh, Math.ceil(y1)); sy++) {
                const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
                if (wy <= 0) continue;
                for (let sx = Math.floor(x0); sx < Math.min(sw, Math.ceil(x1)); sx++) {
                    const wx = Math.min(x1, sx + 1) - Math.max(x0, sx);
                    if (wx <= 0) continue;
                    const w = wx * wy;
                    const i = (sy * sw + sx) * 4;
                    const alpha = (src[i + 3] / 255) * w;
                    r += src[i] * alpha;
                    g += src[i + 1] * alpha;
                    b += src[i + 2] * alpha;
                    a += alpha;
                    area += w;
                }
            }
            const o = (dy * dw + dx) * 4;
            if (a > 0) {
                out[o] = Math.round(r / a);
                out[o + 1] = Math.round(g / a);
                out[o + 2] = Math.round(b / a);
            }
            out[o + 3] = Math.round((a / area) * 255);
        }
    }
    return out;
};

// An opaque RGB canvas: any transparency in the source is flattened on white.
const toOpaque = (img) => {
    const d = Buffer.from(img.data);
    for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3] / 255;
        if (a < 1) {
            d[i] = Math.round(d[i] * a + 255 * (1 - a));
            d[i + 1] = Math.round(d[i + 1] * a + 255 * (1 - a));
            d[i + 2] = Math.round(d[i + 2] * a + 255 * (1 - a));
        }
        d[i + 3] = 255;
    }
    return { ...img, data: d };
};

const crop = (img, x, y, w, h) => {
    const out = Buffer.alloc(w * h * 4);
    for (let row = 0; row < h; row++) {
        img.data.copy(out, row * w * 4, ((y + row) * img.width + x) * 4, ((y + row) * img.width + x + w) * 4);
    }
    return { width: w, height: h, data: out };
};

// The largest centred 16:9 area: equal amounts off left/right for a wider
// image, off top/bottom for a taller one. Pixels are only cut, never
// stretched; an image already 16:9 (to the pixel) is returned as-is.
const cropTo16x9 = (img) => {
    const w = Math.min(img.width, Math.round(img.height * 16 / 9));
    const h = Math.min(img.height, Math.round(img.width * 9 / 16));
    const width = img.width / img.height > 16 / 9 ? w : img.width;
    const height = img.width / img.height > 16 / 9 ? img.height : h;
    if (width === img.width && height === img.height) return img;
    return crop(img, Math.floor((img.width - width) / 2), Math.floor((img.height - height) / 2), width, height);
};

// Landscape and web-sized: portrait/square images are centre-cropped to
// 16:9, and anything wider than OUTPUT_MAX_WIDTH is scaled down. With
// { crop: '16:9' } (Pexels photos) every image is cropped to exactly 16:9
// first. The crop always comes before the logo is placed.
const normalise = (img, { crop: cropMode } = {}) => {
    let out = cropMode === '16:9' ? cropTo16x9(img) : img;
    if (out.width / out.height < MIN_LANDSCAPE) {
        const h = Math.round(out.width * 9 / 16);
        out = crop(out, 0, Math.floor((out.height - h) / 2), out.width, h);
    }
    if (out.width > OUTPUT_MAX_WIDTH) {
        const h = Math.round(out.height * OUTPUT_MAX_WIDTH / out.width);
        out = { width: OUTPUT_MAX_WIDTH, height: h, data: resize(out.data, out.width, out.height, OUTPUT_MAX_WIDTH, h) };
    }
    return out;
};

let logoCache = null;
const logo = () => {
    if (!logoCache) {
        const png = PNG.sync.read(fs.readFileSync(LOGO_PATH));
        logoCache = { width: png.width, height: png.height, data: png.data, scaled: new Map() };
    }
    return logoCache;
};

const scaledLogo = (width) => {
    const l = logo();
    if (!l.scaled.has(width)) {
        const height = Math.max(1, Math.round(width * l.height / l.width));
        l.scaled.set(width, { width, height, data: resize(l.data, l.width, l.height, width, height) });
        if (l.scaled.size > 20) l.scaled.delete(l.scaled.keys().next().value);
    }
    return l.scaled.get(width);
};

const luminance = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

// Is the area behind the logo light and calm enough for a dark logo?
const needsBacking = (img, x, y, w, h) => {
    let sum = 0; let sq = 0; let n = 0;
    for (let row = y; row < y + h; row += 2) {
        for (let col = x; col < x + w; col += 2) {
            const i = (row * img.width + col) * 4;
            const L = luminance(img.data[i], img.data[i + 1], img.data[i + 2]);
            sum += L; sq += L * L; n++;
        }
    }
    const mean = sum / n;
    const sd = Math.sqrt(Math.max(0, sq / n - mean * mean));
    return mean < 0.62 || sd > 0.18;
};

// A white rounded rectangle, partly transparent, with anti-aliased corners.
const drawPlate = (img, x, y, w, h, radius) => {
    for (let row = y; row < y + h; row++) {
        for (let col = x; col < x + w; col++) {
            const cx = col < x + radius ? x + radius : col >= x + w - radius ? x + w - radius - 1 : col;
            const cy = row < y + radius ? y + radius : row >= y + h - radius ? y + h - radius - 1 : row;
            const dist = Math.hypot(col - cx, row - cy);
            const coverage = Math.max(0, Math.min(1, radius + 0.5 - dist));
            if (coverage <= 0) continue;
            const a = PLATE_ALPHA * coverage;
            const i = (row * img.width + col) * 4;
            img.data[i] = Math.round(img.data[i] * (1 - a) + 255 * a);
            img.data[i + 1] = Math.round(img.data[i + 1] * (1 - a) + 255 * a);
            img.data[i + 2] = Math.round(img.data[i + 2] * (1 - a) + 255 * a);
        }
    }
};

// Standard "over" compositing of the RGBA logo onto the opaque image.
const drawLogo = (img, mark, x, y) => {
    for (let row = 0; row < mark.height; row++) {
        for (let col = 0; col < mark.width; col++) {
            const s = (row * mark.width + col) * 4;
            const a = mark.data[s + 3] / 255;
            if (a === 0) continue;
            const d = ((y + row) * img.width + (x + col)) * 4;
            img.data[d] = Math.round(mark.data[s] * a + img.data[d] * (1 - a));
            img.data[d + 1] = Math.round(mark.data[s + 1] * a + img.data[d + 1] * (1 - a));
            img.data[d + 2] = Math.round(mark.data[s + 2] * a + img.data[d + 2] * (1 - a));
        }
    }
};

// Where the logo goes on an image this wide: top-right, the same margin from
// the top and the right edge.
const placement = (width) => {
    const l = logo();
    const w = Math.round(width * LOGO_WIDTH_SHARE);
    const h = Math.max(1, Math.round(w * l.height / l.width));
    const margin = Math.round(width * MARGIN_SHARE);
    return { width: w, height: h, x: width - margin - w, y: margin };
};

// buffer (PNG or JPEG) → { buffer, mimeType: 'image/jpeg', width, height, logo }
// Order: decode → crop/resize → logo → JPEG. `options.crop: '16:9'` makes the
// output exactly 16:9; both automatic sources (AI images and Pexels photos)
// use it.
const brandImage = (input, options = {}) => {
    const img = toOpaque(normalise(decode(Buffer.from(input)), options));
    const place = placement(img.width, img.height);
    const mark = scaledLogo(place.width);

    const padX = Math.round(mark.height * 0.45);
    const padY = Math.round(mark.height * 0.3);
    const plate = { x: place.x - padX, y: place.y - padY, width: mark.width + 2 * padX, height: mark.height + 2 * padY };
    const backing = needsBacking(img, place.x, place.y, mark.width, mark.height);
    if (backing) drawPlate(img, plate.x, plate.y, plate.width, plate.height, Math.round(mark.height * 0.35));
    drawLogo(img, mark, place.x, place.y);

    const buffer = Buffer.from(jpeg.encode({ data: img.data, width: img.width, height: img.height }, JPEG_QUALITY).data);
    return {
        buffer,
        mimeType: 'image/jpeg',
        width: img.width,
        height: img.height,
        logo: { x: place.x, y: place.y, width: mark.width, height: mark.height, backing }
    };
};

module.exports = { brandImage, decode, placement, sniff, LOGO_PATH, OUTPUT_MAX_WIDTH, LOGO_WIDTH_SHARE, MARGIN_SHARE };
