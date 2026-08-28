import { describe, expect, it } from "vitest";
import { detailOf } from "../api-error";

describe("detailOf", () => {
  it("prefers the server's sentence over axios' status line", () => {
    const err = {
      message: "Request failed with status code 422",
      response: { data: { detail: "Message cannot be empty" } },
    };
    expect(detailOf(err, "fallback")).toBe("Message cannot be empty");
  });

  it("falls back when there is no detail to show", () => {
    expect(detailOf(new Error("boom"), "fallback")).toBe("fallback");
    expect(detailOf({ response: {} }, "fallback")).toBe("fallback");
    expect(detailOf({ response: { data: {} } }, "fallback")).toBe("fallback");
    expect(detailOf(undefined, "fallback")).toBe("fallback");
    expect(detailOf(null, "fallback")).toBe("fallback");
  });

  it("falls back for a blank or non-string detail", () => {
    // A blank detail would render as an empty toast, which reads as a bug.
    expect(detailOf({ response: { data: { detail: "   " } } }, "fallback")).toBe("fallback");
    expect(detailOf({ response: { data: { detail: 422 } } }, "fallback")).toBe("fallback");
    expect(detailOf({ response: { data: { detail: null } } }, "fallback")).toBe("fallback");
  });

  it("does not throw on a hostile shape", () => {
    expect(detailOf("a string", "fallback")).toBe("fallback");
    expect(detailOf([], "fallback")).toBe("fallback");
  });
});
