import { Database } from "lucide-react";

interface NoResultProps {
  message?: string;
}

const NoResult = ({ message = "No results found" }: NoResultProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground py-12">
      <Database size={52} className="text-gray-400" />
      <div className="text-center">
        <p className="text-black font-medium">{message}</p>
        <p className="text-sm text-gray-500 mt-1">
          Try adjusting your search or filter to find what you're looking for.
        </p>
      </div>
    </div>
  );
};

export default NoResult;
