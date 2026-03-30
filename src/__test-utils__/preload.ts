import { mock } from "bun:test";
import { mockDb } from "./db-mock";

// Mock db/connection globally for all test files
mock.module("../db/connection", () => ({ db: mockDb }));
mock.module("../../db/connection", () => ({ db: mockDb }));

// Resolve alternative path patterns
mock.module("src/db/connection", () => ({ db: mockDb }));
