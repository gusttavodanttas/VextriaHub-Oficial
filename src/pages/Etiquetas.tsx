

import { TagManager } from "@/components/Publications/TagManager";
import { Tag } from "lucide-react";

export default function Etiquetas() {
  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Tag className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Etiquetas</h1>
        </div>
        
        <TagManager />
      </div>
    </div>
  );
}
