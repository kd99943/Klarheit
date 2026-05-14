import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders children text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("applies primary variant styles by default", () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-brand-primary");
  });

  it("applies outline-dark variant styles", () => {
    render(<Button variant="outline-dark">Outline</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("border");
    expect(button.className).toContain("text-white");
  });

  it("applies outline-light variant styles", () => {
    render(<Button variant="outline-light">Outline Light</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("border-brand-primary");
  });

  it("renders as disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button.className).toContain("disabled:opacity-60");
  });

  it("merges custom className", () => {
    render(<Button className="custom-class">Custom</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("custom-class");
  });
});
