
import { OrbitalLoader } from "@/components/ui/orbital-loader";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <OrbitalLoader message="Syncing with your mood..." />
    </div>
  );
}
