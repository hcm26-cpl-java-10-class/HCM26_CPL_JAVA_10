import * as React from "react"

import { cn } from "@/lib/utils"

interface TextareaProps extends React.ComponentProps<"textarea"> {
  showCount?: boolean;
}

function Textarea({ 
  className, 
  maxLength = 500, 
  showCount = true, 
  value, 
  defaultValue, 
  onChange, 
  ...props 
}: TextareaProps) {
  const [textLength, setTextLength] = React.useState<number>(
    () => {
      const initial = value ?? defaultValue ?? "";
      return String(initial).length;
    }
  );

  // Cập nhật chiều dài khi giá trị thay đổi từ bên ngoài (form reset/patch)
  React.useEffect(() => {
    if (value !== undefined) {
      setTextLength(String(value).length);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextLength(e.target.value.length);
    onChange?.(e);
  };

  return (
    <div className="relative w-full">
      <textarea
        data-slot="textarea"
        maxLength={maxLength}
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        className={cn(
          "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 pb-6 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
          className
        )}
        {...props}
      />
      {showCount && maxLength && (
        <div className="absolute bottom-1.5 right-3 text-xs text-muted-foreground pointer-events-none select-none">
          {textLength}/{maxLength}
        </div>
      )}
    </div>
  )
}

export { Textarea }