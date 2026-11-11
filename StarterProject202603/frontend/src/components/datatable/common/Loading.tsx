import { Loader } from "lucide-react";

const Loading = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground py-12">
      <Loader size={32} className="animate-spin text-gray-500" />
      <p className="text-sm text-gray-500">Loading...</p>
    </div>
  );
};

export default Loading;
