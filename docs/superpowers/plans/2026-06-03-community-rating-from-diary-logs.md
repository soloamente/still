# Community Patron Score From Diary Logs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sense community rating on film/TV detail reflects public diary log scores, not published reviews.

**Architecture:** Shared server helper dedupes one rating per patron via `DISTINCT ON (user_id)`, then averages on the 0–10 display scale. Movie and TV detail routes return `community.ratingsCount`; web hero copy says “ratings”.

**Tech Stack:** Drizzle/Postgres, Elysia, Next.js App Router, Bun test

---

## Status

Implemented in session 2026-06-03. See spec `docs/superpowers/specs/2026-06-03-community-rating-from-diary-logs-design.md`.
