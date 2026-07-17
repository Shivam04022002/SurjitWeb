// Idempotency + per-migration rollback helpers.
//
// Production MongoDB here is a standalone server (no replica set), so multi-doc
// transactions are unavailable. Instead, each migration runs inside a
// MigrationContext that records every NEWLY-CREATED document; if the migration
// throws, we compensate by deleting exactly those new documents (updates to
// pre-existing docs are left untouched). Because all writes are idempotent
// upserts, re-running after a rollback is always safe.

class MigrationContext {
    constructor(name) {
        this.name = name;
        this.created = [];               // { Model, id }
        this.counts = { created: 0, updated: 0, reused: 0, uploaded: 0 };
    }

    track(Model, id) {
        this.created.push({ Model, id });
    }

    async rollback() {
        let removed = 0;
        for (const { Model, id } of this.created.slice().reverse()) {
            try {
                await Model.deleteOne({ _id: id });
                removed += 1;
            } catch (_) { /* best effort */ }
        }
        return removed;
    }
}

// Upsert a document identified by `filter`. Existing docs are updated in place;
// only inserts are tracked for rollback. Returns { doc, created }.
async function upsertOne(Model, filter, data, ctx) {
    const existing = await Model.findOne(filter);
    if (existing) {
        existing.set(data);
        await existing.save();
        if (ctx) ctx.counts.updated += 1;
        return { doc: existing, created: false };
    }
    const doc = await Model.create(data);
    if (ctx) {
        ctx.track(Model, doc._id);
        ctx.counts.created += 1;
    }
    return { doc, created: true };
}

// Singleton collections (CompanyInfo, CareerSettings, GlobalSettings): only ever
// one document, matched with an empty filter.
async function upsertSingleton(Model, data, ctx) {
    return upsertOne(Model, {}, data, ctx);
}

module.exports = { MigrationContext, upsertOne, upsertSingleton };
