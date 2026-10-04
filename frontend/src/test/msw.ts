/// <reference types="vitest/globals" />
import { server } from "./server";

export function setupMsw() {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}

export { server };
