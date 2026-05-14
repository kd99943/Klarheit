import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FormField } from "./FormField";

describe("FormField", () => {
  it("renders the label text", () => {
    render(<FormField label="Email Address" />);
    expect(screen.getByText("Email Address")).toBeInTheDocument();
  });

  it("renders hint text when provided", () => {
    render(<FormField label="Password" hint="At least 8 characters" />);
    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
  });

  it("does not render hint when not provided", () => {
    render(<FormField label="Name" />);
    expect(screen.queryByText(/.+/i, { selector: "p.text-xs" })).not.toBeInTheDocument();
  });

  it("passes input props through to the input element", () => {
    render(<FormField label="Email" type="email" placeholder="test@example.com" />);
    const input = screen.getByPlaceholderText("test@example.com");
    expect(input).toHaveAttribute("type", "email");
  });

  it("renders with default value", () => {
    render(<FormField label="SPH" defaultValue="-2.25" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("-2.25");
  });
});
