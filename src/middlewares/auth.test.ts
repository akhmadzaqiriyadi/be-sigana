import { describe, expect, it, mock, beforeEach } from "bun:test";
import { Request, Response, NextFunction } from "express";

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

import { authenticate, optionalAuthenticate } from "./auth";

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
        role: "RELAWAN",
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
  });

  describe("optionalAuthenticate (graceful)", () => {
    it("should set req.user with valid token", () => {
      const mockPayload = {
        userId: "user-1",
        email: "test@test.com",
        role: "RELAWAN",
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
  });
});
