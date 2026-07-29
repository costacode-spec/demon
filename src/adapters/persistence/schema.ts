// Drizzle schema: the tables ARE this TypeScript. Types flow from here.
import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const targets = pgTable("targets", {
  id: serial("id").primaryKey(),
  spec: text("spec").notNull().unique(),
  verificationStatus: text("verification_status").notNull().default("verified"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scans = pgTable("scans", {
  id: serial("id").primaryKey(),
  targetId: integer("target_id")
    .notNull()
    .references(() => targets.id),
  status: text("status").notNull().default("queued"),
  profile: text("profile").notNull().default("standard"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const findings = pgTable("findings", {
  id: serial("id").primaryKey(),
  scanId: integer("scan_id")
    .notNull()
    .references(() => scans.id),
  templateId: text("template_id").notNull(),
  severity: text("severity"),
  matchedAt: text("matched_at"),
  raw: jsonb("raw"),
});
