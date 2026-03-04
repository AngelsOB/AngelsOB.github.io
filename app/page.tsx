import type { Metadata } from "next";
import Home from "../src/views/Home";

export const metadata: Metadata = {
  title: "BeerApp - Homebrewing Recipe Builder & Calculator",
  description:
    "Gravity calculators, brew-day math, and a recipe builder that understands your system. Built for brewers who care about the details.",
};

export default function HomePage() {
  return <Home />;
}
