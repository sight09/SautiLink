"use client";

import type { Lang } from "./i18n";

export type QueuedEvidence = { type: string; label: string; storageRef: string; sizeBytes: number };

export type QueuedReport = {
  localId: string;
  categorySlug: string;
  description: string;
  areaName: string;
  locationNote: string;
  anonymous: boolean;
  reporterContact: string;
  language: Lang;
  evidence: QueuedEvidence[];
  savedAt: string;
  lastError?: string;
  attempts: number;
};

export type SavedCase = {
  publicCaseId: string;
  accessCode: string;
  title: string;
  categorySlug: string;
  createdAt: string;
  anonymous: boolean;
};

const QUEUE_KEY = "sautilink.queue.v1";
const CASES_KEY = "sautilink.cases.v1";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("sautilink:storage", { detail: key }));
}

export function getQueue(): QueuedReport[] {
  return read<QueuedReport>(QUEUE_KEY);
}

export function enqueueReport(report: Omit<QueuedReport, "localId" | "savedAt" | "attempts">): QueuedReport {
  const item: QueuedReport = {
    ...report,
    localId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    savedAt: new Date().toISOString(),
    attempts: 0,
  };
  write(QUEUE_KEY, [item, ...getQueue()]);
  return item;
}

export function updateQueued(localId: string, patch: Partial<QueuedReport>): void {
  write(
    QUEUE_KEY,
    getQueue().map((item) => (item.localId === localId ? { ...item, ...patch } : item)),
  );
}

export function removeQueued(localId: string): void {
  write(
    QUEUE_KEY,
    getQueue().filter((item) => item.localId !== localId),
  );
}

export function getSavedCases(): SavedCase[] {
  return read<SavedCase>(CASES_KEY);
}

export function saveCase(entry: SavedCase): void {
  const existing = getSavedCases().filter((c) => c.publicCaseId !== entry.publicCaseId);
  write(CASES_KEY, [entry, ...existing]);
}

export function findSavedCase(publicCaseId: string): SavedCase | undefined {
  return getSavedCases().find((c) => c.publicCaseId.toUpperCase() === publicCaseId.toUpperCase());
}

export type SyncResult = {
  synced: SavedCase[];
  failed: number;
};

/** Submits everything in the queue. Case IDs are only created by the server. */
export async function syncQueue(): Promise<SyncResult> {
  const queue = getQueue();
  const synced: SavedCase[] = [];
  let failed = 0;

  for (const item of queue) {
    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          categorySlug: item.categorySlug,
          description: item.description,
          areaName: item.areaName,
          locationNote: item.locationNote,
          anonymous: item.anonymous,
          reporterContact: item.reporterContact,
          language: item.language,
          evidence: item.evidence,
          channel: "offline-sync",
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as {
        publicCaseId: string;
        accessCode: string;
        title: string;
      };
      const saved: SavedCase = {
        publicCaseId: data.publicCaseId,
        accessCode: data.accessCode,
        title: data.title,
        categorySlug: item.categorySlug,
        createdAt: new Date().toISOString(),
        anonymous: item.anonymous,
      };
      saveCase(saved);
      removeQueued(item.localId);
      synced.push(saved);
    } catch (error) {
      failed += 1;
      updateQueued(item.localId, {
        attempts: item.attempts + 1,
        lastError: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { synced, failed };
}
