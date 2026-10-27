import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  client: vi.fn(),
  getUser: vi.fn(),
  account: vi.fn(),
  learning: vi.fn(),
  rows: vi.fn(),
  journal: vi.fn(),
}));
vi.mock("@/lib/auth/config", () => ({ authConfig: mocks.config }));
vi.mock("@/lib/auth/server", () => ({ serverClient: mocks.client }));
vi.mock("@/lib/practice/server", () => ({ accountWorkspace: mocks.account }));
vi.mock("@/lib/curriculum/server", () => ({
  curriculumWorkspace: mocks.learning,
}));
vi.mock("@/lib/practice/pagination", () => ({ collectRows: mocks.rows }));
vi.mock("@/lib/journal/server", () => ({ journalWorkspace: mocks.journal }));
import { GET } from "../src/app/api/export/route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.mockReturnValue({});
  mocks.journal.mockResolvedValue({
    ready: true,
    setups: [],
    trades: [],
    screenshots: [],
    frozen: false,
    developmentCount: 0,
    heldOutCount: 0,
  });
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.getUser } });
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "verified-user" } },
    error: null,
  });
  mocks.account.mockResolvedValue({
    profile: { timezone: "Africa/Nairobi" },
    data: { version: 1 },
    taskOutcomes: {},
  });
  mocks.learning.mockResolvedValue({
    ready: true,
    phases: [],
    lessons: [],
    evidence: [{ id: "evidence-a" }],
  });
  mocks.rows.mockResolvedValue({
    data: [{ reflection: "My review" }],
    error: null,
  });
});
it("denies signed-out exports before reading account data", async () => {
  mocks.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: "signed out" },
  });
  const r = await GET();
  expect(r.status).toBe(401);
  expect(mocks.account).not.toHaveBeenCalled();
});
it("exports saved learning evidence and reviews with private cache headers", async () => {
  const r = await GET();
  expect(r.status).toBe(200);
  expect(r.headers.get("cache-control")).toContain("no-store");
  expect(r.headers.get("content-disposition")).toContain("attachment");
  const json = await r.json();
  expect(json.curriculum.evidence).toEqual([{ id: "evidence-a" }]);
  expect(json.weeklyReviews).toEqual([{ reflection: "My review" }]);
});
it("never downloads partial data as a successful export", async () => {
  mocks.rows.mockResolvedValue({ data: [], error: new Error("offline") });
  const r = await GET();
  expect(r.status).toBe(503);
  expect(r.headers.get("content-disposition")).toBeNull();
  expect((await r.json()).curriculum).toBeUndefined();
});
