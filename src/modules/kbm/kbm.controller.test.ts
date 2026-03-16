import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const sendSuccess = mock();
const sendCreated = mock();

mock.module("@/utils/response", () => ({
  sendSuccess,
  sendCreated,
}));

function createResponse() {
  return {} as any;
}

async function flushAsyncHandler() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

let originalFindAll: unknown;
let originalUpdate: unknown;

describe("KbmController", () => {
  beforeEach(async () => {
    sendSuccess.mockClear();
    sendCreated.mockClear();

    const { kbmService } = await import("./kbm.service");
    originalFindAll ??= kbmService.findAll;
    originalUpdate ??= kbmService.update;
  });

  afterEach(async () => {
    const { kbmService } = await import("./kbm.service");
    kbmService.findAll = originalFindAll as any;
    kbmService.update = originalUpdate as any;
  });

  it("should return KBM references", async () => {
    const { getKbmReferences } = await import("./kbm.controller");
    const { kbmService } = await import("./kbm.service");
    const res = createResponse();
    const next = mock();
    const data = [{ id: 1, usiaBulan: 0, kbmMinimal: 4200 }];
    kbmService.findAll = mock(async () => data) as any;

    getKbmReferences({} as any, res, next as any);
    await flushAsyncHandler();

    expect(kbmService.findAll).toHaveBeenCalled();
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      "Referensi KBM berhasil diambil",
      data
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should update KBM reference using authenticated user email", async () => {
    const { updateKbmReference } = await import("./kbm.controller");
    const { kbmService } = await import("./kbm.service");
    const res = createResponse();
    const next = mock();
    const updated = { id: 5, kbmMinimal: 6000, updatedBy: "admin@sigana.id" };
    kbmService.update = mock(async () => updated) as any;

    updateKbmReference(
      {
        params: { id: "5" },
        body: { kbmMinimal: 6000 },
        user: { email: "admin@sigana.id" },
      } as any,
      res,
      next as any
    );
    await flushAsyncHandler();

    expect(kbmService.update).toHaveBeenCalledWith(5, {
      kbmMinimal: 6000,
      updatedBy: "admin@sigana.id",
    });
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      "Referensi KBM berhasil diperbarui",
      updated
    );
  });

  it("should pass UnauthorizedError to next when user is missing", async () => {
    const { updateKbmReference } = await import("./kbm.controller");
    const next = mock();

    updateKbmReference(
      { params: { id: "5" }, body: { kbmMinimal: 6000 } } as any,
      createResponse(),
      next as any
    );
    await flushAsyncHandler();

    expect(next).toHaveBeenCalled();
    const [error] = next.mock.calls[0];
    expect(error.statusCode).toBe(401);
  });
});
