import { notFound } from "next/navigation";
import SteeringPlaygroundClient from "./SteeringPlaygroundClient";

export const metadata = {
  title: "Steering Playground (dev)",
  robots: { index: false, follow: false },
};

// Dev-only — this page's data comes from app/api/lab/steering, which reads
// the gitignored local cloud.ndjson. See that route for the containment note.
export default function SteeringPlaygroundPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SteeringPlaygroundClient />;
}
