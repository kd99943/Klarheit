import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function WorkingChild() {
  return <div>Working content</div>;
}

function ThrowingChild() {
  throw new Error("Test error");
}

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <WorkingChild />
      </ErrorBoundary>
    );
    expect(screen.getByText("Working content")).toBeInTheDocument();
  });

  it("renders error fallback when a child throws", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Refresh Page")).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("renders refresh button that is clickable", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );

    const refreshButton = screen.getByRole("button", { name: "Refresh Page" });
    expect(refreshButton).toBeEnabled();

    consoleSpy.mockRestore();
  });
});
