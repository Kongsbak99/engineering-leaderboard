import type { Db } from "mongodb";
import {
  engineersCol,
  projectsCol,
  syncMetadataCol,
} from "./collections";

export async function getLastSync(db: Db, key: string): Promise<Date | null> {
  const doc = await syncMetadataCol(db).findOne({ key });
  return doc?.lastSyncedAt ?? null;
}

export async function updateLastSync(db: Db, key: string): Promise<void> {
  await syncMetadataCol(db).updateOne(
    { key },
    { $set: { key, lastSyncedAt: new Date() } },
    { upsert: true }
  );
}

export async function getOrCreateEngineerByGithub(
  db: Db,
  githubUsername: string,
  avatarUrl?: string,
  displayName?: string
): Promise<string> {
  const result = await engineersCol(db).findOneAndUpdate(
    { githubUsername },
    {
      $setOnInsert: {
        githubUsername,
        displayName: displayName ?? githubUsername,
        avatarUrl: avatarUrl ?? null,
        createdAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after" }
  );
  return result!._id!.toString();
}

export async function getOrCreateEngineerByLinear(
  db: Db,
  linearUserId: string,
  displayName: string,
  avatarUrl?: string
): Promise<string> {
  const existing = await engineersCol(db).findOne({ linearId: linearUserId });
  if (existing) return existing._id!.toString();

  const placeholderGithub = `linear-${linearUserId}`;
  const result = await engineersCol(db).findOneAndUpdate(
    { githubUsername: placeholderGithub },
    {
      $set: {
        linearId: linearUserId,
        displayName,
        avatarUrl: avatarUrl ?? null,
      },
      $setOnInsert: {
        githubUsername: placeholderGithub,
        createdAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after" }
  );
  return result!._id!.toString();
}

export async function getOrCreateProject(
  db: Db,
  linearProjectId: string,
  name: string,
  description?: string,
  state?: string
): Promise<string> {
  const result = await projectsCol(db).findOneAndUpdate(
    { linearProjectId },
    {
      $set: {
        name,
        description: description ?? null,
        state: state ?? null,
      },
      $setOnInsert: {
        linearProjectId,
        status: "active" as const,
        startedAt: null,
        targetDate: null,
        createdAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after" }
  );
  return result!._id!.toString();
}
