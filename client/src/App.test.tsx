import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";
import { Connection } from "./types";

test("renders learn react link", () => {
  render(<App ownName="" conn={undefined as unknown as Connection} />);
  const linkElement = screen.getByText(/learn react/i);
  expect(linkElement).toBeInTheDocument();
});
