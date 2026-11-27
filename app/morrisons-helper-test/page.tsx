import type { Metadata } from "next";
import MorrisonsHelperDryRun from "./dry-run";

export const metadata: Metadata = {
  title: "Morrisons helper dry run",
  description: "Local mock of Morrisons product and search controls for the trolley helper. Nothing is sent to Morrisons or Wix.",
};

export default function MorrisonsHelperTestPage() {
  return <MorrisonsHelperDryRun />;
}
