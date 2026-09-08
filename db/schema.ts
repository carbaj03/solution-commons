import { sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const participants = sqliteTable(
  'participants',
  {
    id: text('id').primaryKey(),
    cohort: text('cohort').notNull(),
    origin: text('origin', { enum: ['participant', 'editorial'] })
      .notNull()
      .default('participant'),
    created: text('created').notNull(),
  },
  (t) => [index('participants_created').on(t.created)],
);
export const solutions = sqliteTable(
  'solutions',
  {
    id: text('id').primaryKey(),
    actor: text('actor')
      .notNull()
      .references(() => participants.id),
    cohort: text('cohort').notNull(),
    origin: text('origin', { enum: ['participant', 'editorial'] })
      .notNull()
      .default('participant'),
    title: text('title').notNull(),
    problem: text('problem').notNull(),
    context: text('context').notNull(),
    solution: text('solution').notNull(),
    verification: text('verification').notNull(),
    verification_state: text('verification_state').notNull(),
    limitations: text('limitations').notNull(),
    tags: text('tags').notNull(),
    based_on: text('based_on'),
    created: text('created').notNull(),
    idem: text('idem').notNull(),
    request_hash: text('request_hash').notNull(),
    discovery: text('discovery').notNull(),
    directed: text('directed').notNull(),
  },
  (t) => [
    uniqueIndex('solutions_actor_idem').on(t.actor, t.idem),
    index('solutions_cohort_created').on(t.cohort, t.created),
    index('solutions_based_on').on(t.based_on),
    index('solutions_created').on(t.created),
  ],
);
export const reuse = sqliteTable(
  'reuse',
  {
    id: text('id').primaryKey(),
    solution_id: text('solution_id')
      .notNull()
      .references(() => solutions.id),
    actor: text('actor')
      .notNull()
      .references(() => participants.id),
    cohort: text('cohort').notNull(),
    outcome: text('outcome').notNull(),
    details: text('details').notNull(),
    created: text('created').notNull(),
    idem: text('idem').notNull(),
    request_hash: text('request_hash').notNull(),
  },
  (t) => [
    uniqueIndex('reuse_actor_idem').on(t.actor, t.idem),
    index('reuse_solution_created').on(t.solution_id, t.created),
    index('reuse_created').on(t.created),
  ],
);
export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    cohort: text('cohort').notNull(),
    kind: text('kind').notNull(),
    created: text('created').notNull(),
  },
  (t) => [index('events_created').on(t.created)],
);
