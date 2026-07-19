import { describe, expect, it, mock, beforeEach } from "bun:test";
import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";

// We need a real JsonWebTokenError class for instanceof checks in middleware
class JsonWebTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JsonWebTokenError";
  }
}

const jwtMock = {
  sign: mock(),
  verify: mock(),
  JsonWebTokenError,
};

// Mock jsonwebtoken — must include JsonWebTokenError for instanceof checks in middleware
mock.module("jsonwebtoken", () => ({
  default: jwtMock,
  JsonWebTokenError,
}));

// Mock env
mock.module("@/config/env", () => ({
  env: {
    JWT_SECRET: "test-secret",
    JWT_REFRESH_SECRET: "test-refresh-secret",
  },
}));

import {
  authenticate,
  optionalAuthenticate,
  authorize,
  authorizeAdminOrOwner,
} from "./auth";

// Helper to create mock req/res/next
function createMocks(overrides: Partial<Request> = {}) {
  const req = {
    headers: {},
    cookies: {},
    user: undefined,
    ...overrides,
  } as unknown as Request;

  const res = {} as Response;

  let nextCalled = false;
  let nextError: any = undefined;
  const next: NextFunction = (err?: any) => {
    nextCalled = true;
    nextError = err;
  };

  return {
    req,
    res,
    next,
    getNextCalled: () => nextCalled,
    getNextError: () => nextError,
  };
}

describe("Auth Middleware", () => {
  beforeEach(() => {
    jwtMock.verify.mockClear?.();
  });

  describe("authenticate (strict)", () => {
    it("should set req.user and call next() with valid token", () => {
      const mockPayload = {
        userId: "user-1",
        email: "test@test.com",
        role: "RELAWAN" as Role,
      };
      jwtMock.verify.mockReturnValue(mockPayload);

      const { req, res, next } = createMocks({
        headers: { authorization: "Bearer valid_token" },
      } as any);

      authenticate(req, res, next);

      expect(req.user).toEqual(mockPayload);
    });

    it("should call next with UnauthorizedError when no token provided", () => {
      const { req, res, next, getNextError } = createMocks();

      authenticate(req, res, next);

      const error = getNextError();
      expect(error).toBeDefined();
      expect(error).toHaveProperty("statusCode", 401);
    });

    it("should call next with UnauthorizedError on expired token", () => {
      jwtMock.verify.mockImplementation(() => {
        throw new JsonWebTokenError("jwt expired");
      });

      const { req, res, next, getNextError } = createMocks({
        headers: { authorization: "Bearer expired_token" },
      } as any);

      authenticate(req, res, next);

      const error = getNextError();
      expect(error).toBeDefined();
      expect(error).toHaveProperty("statusCode", 401);
    });

    it("should ignore 'undefined' and 'null' string tokens", () => {
      const { req, res, next, getNextError } = createMocks({
        headers: { authorization: "Bearer undefined" },
      } as any);

      authenticate(req, res, next);

      const error = getNextError();
      expect(error).toBeDefined();
      expect(error).toHaveProperty("statusCode", 401);
    });

    it("should return 401 for malformed auth header (no Bearer prefix)", () => {
      const { req, res, next, getNextError } = createMocks({
        headers: { authorization: "Basic dG9rZW4=" },
      } as any);

      authenticate(req, res, next);

      const error = getNextError();
      expect(error).toBeDefined();
      expect(error).toHaveProperty("statusCode", 401);
    });

    it("should fall back to cookie token when no auth header", () => {
      const mockPayload = {
        userId: "user-1",
        email: "test@test.com",
        role: "RELAWAN" as Role,
      };
      jwtMock.verify.mockReturnValue(mockPayload);

      const { req, res, next } = createMocks({
        cookies: { token: "cookie_token" },
      } as any);

      authenticate(req, res, next);

      expect(req.user).toEqual(mockPayload);
    });

    it("should prefer auth header over cookie when both present", () => {
      const headerPayload = {
        userId: "header-user",
        email: "h@b.com",
        role: "ADMIN" as Role,
      };
      jwtMock.verify.mockReturnValue(headerPayload);

      const { req, res, next } = createMocks({
        headers: { authorization: "Bearer header_token" },
        cookies: { token: "cookie_token" },
      } as any);

      authenticate(req, res, next);

      expect(req.user).toEqual(headerPayload);
    });

    it("should return 401 for tampered token (bad signature)", () => {
      jwtMock.verify.mockImplementation(() => {
        throw new JsonWebTokenError("invalid signature");
      });

      const { req, res, next, getNextError } = createMocks({
        headers: { authorization: "Bearer tampered_token" },
      } as any);

      authenticate(req, res, next);

      const error = getNextError();
      expect(error).toBeDefined();
      expect(error).toHaveProperty("statusCode", 401);
    });
  });

  describe("optionalAuthenticate (graceful)", () => {
    it("should set req.user with valid token", () => {
      const mockPayload = {
        userId: "user-1",
        email: "test@test.com",
        role: "RELAWAN" as Role,
      };
      jwtMock.verify.mockReturnValue(mockPayload);

      const { req, res, next, getNextCalled } = createMocks({
        headers: { authorization: "Bearer valid_token" },
      } as any);

      optionalAuthenticate(req, res, next);

      expect(req.user).toEqual(mockPayload);
      expect(getNextCalled()).toBe(true);
    });

    it("should NOT throw on expired token — req.user stays undefined", () => {
      jwtMock.verify.mockImplementation(() => {
        throw new JsonWebTokenError("jwt expired");
      });

      const { req, res, next, getNextCalled, getNextError } = createMocks({
        headers: { authorization: "Bearer expired_token" },
      } as any);

      optionalAuthenticate(req, res, next);

      expect(req.user).toBeUndefined();
      expect(getNextCalled()).toBe(true);
      expect(getNextError()).toBeUndefined(); // No error passed to next
    });

    it("should NOT throw when no token at all", () => {
      const { req, res, next, getNextCalled, getNextError } = createMocks();

      optionalAuthenticate(req, res, next);

      expect(req.user).toBeUndefined();
      expect(getNextCalled()).toBe(true);
      expect(getNextError()).toBeUndefined();
    });

    it("should NOT throw when token is 'undefined' string", () => {
      const { req, res, next, getNextCalled, getNextError } = createMocks({
        headers: { authorization: "Bearer undefined" },
      } as any);

      optionalAuthenticate(req, res, next);

      expect(req.user).toBeUndefined();
      expect(getNextCalled()).toBe(true);
      expect(getNextError()).toBeUndefined();
    });

    it("should fall back to cookie when no header token", () => {
      const mockPayload = {
        userId: "user-1",
        email: "test@test.com",
        role: "RELAWAN" as Role,
      };
      jwtMock.verify.mockReturnValue(mockPayload);

      const { req, res, next, getNextCalled } = createMocks({
        cookies: { token: "cookie_token" },
      } as any);

      optionalAuthenticate(req, res, next);

      expect(req.user).toEqual(mockPayload);
      expect(getNextCalled()).toBe(true);
    });
  });

  describe("authorize (role guard)", () => {
    it("should call next() when role matches", () => {
      const req = {
        user: { userId: "u1", email: "a@b.com", role: "ADMIN" as Role },
      } as any;
      const next = mock();

      authorize("ADMIN")(req, {} as any, next);

      expect(next).toHaveBeenCalled();
      // Verify no error was passed
      expect(next.mock.calls[0]?.[0]).toBeUndefined();
    });

    it("should call next() with ForbiddenError when role does not match", () => {
      const req = {
        user: { userId: "u1", email: "a@b.com", role: "RELAWAN" as Role },
      } as any;
      const next = mock();

      authorize("ADMIN")(req, {} as any, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toHaveProperty("statusCode", 403);
    });

    it("should call next() when one of multiple roles matches", () => {
      const req = {
        user: { userId: "u1", email: "a@b.com", role: "RELAWAN" as Role },
      } as any;
      const next = mock();

      authorize("ADMIN", "RELAWAN")(req, {} as any, next);

      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0]?.[0]).toBeUndefined();
    });

    it("should call next() with ForbiddenError when none of multiple roles match", () => {
      const req = {
        user: { userId: "u1", email: "a@b.com", role: "RELAWAN" as Role },
      } as any;
      const next = mock();

      authorize("ADMIN", "STAKEHOLDER")(req, {} as any, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toHaveProperty("statusCode", 403);
    });

    it("should call next() with UnauthorizedError when req.user is undefined", () => {
      const req = { user: undefined } as any;
      const next = mock();

      authorize("ADMIN")(req, {} as any, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toHaveProperty("statusCode", 401);
    });
  });

  describe("authorizeAdminOrOwner", () => {
    it("should call next() for ADMIN role", () => {
      const req = {
        user: {
          userId: "admin-1",
          email: "admin@test.com",
          role: "ADMIN" as Role,
        },
        params: { id: "some-other-id" },
      } as any;
      const next = mock();

      authorizeAdminOrOwner(req, {} as any, next);

      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0]?.[0]).toBeUndefined();
    });

    it("should call next() when userId matches params.id (owner)", () => {
      const req = {
        user: {
          userId: "user-1",
          email: "user@test.com",
          role: "RELAWAN" as Role,
        },
        params: { id: "user-1" },
      } as any;
      const next = mock();

      authorizeAdminOrOwner(req, {} as any, next);

      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0]?.[0]).toBeUndefined();
    });

    it("should call next() with ForbiddenError when non-admin and not owner", () => {
      const req = {
        user: {
          userId: "user-1",
          email: "user@test.com",
          role: "RELAWAN" as Role,
        },
        params: { id: "other-user-2" },
      } as any;
      const next = mock();

      authorizeAdminOrOwner(req, {} as any, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toHaveProperty("statusCode", 403);
    });

    it("should call next() for ADMIN even when accessing another user's resource", () => {
      const req = {
        user: {
          userId: "admin-1",
          email: "admin@test.com",
          role: "ADMIN" as Role,
        },
        params: { id: "other-user-99" },
      } as any;
      const next = mock();

      authorizeAdminOrOwner(req, {} as any, next);

      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0]?.[0]).toBeUndefined();
    });

    it("should call next() with UnauthorizedError when req.user is undefined", () => {
      const req = {
        user: undefined,
        params: { id: "some-id" },
      } as any;
      const next = mock();

      authorizeAdminOrOwner(req, {} as any, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toHaveProperty("statusCode", 401);
    });
  });
});
