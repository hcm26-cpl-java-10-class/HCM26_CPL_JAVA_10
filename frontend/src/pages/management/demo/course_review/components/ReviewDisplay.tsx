import { useState } from "react";
import { UserAvatar } from "./UserAvatar";

interface ReviewAuthorProps {
  name?: string | null;
  children?: React.ReactNode;
}

export function ReviewAuthor({
  name,
  children,
}: ReviewAuthorProps) {
  return (
    <div className="flex items-center gap-3">
      <UserAvatar
        name={name}
        className="h-10 w-10"
      />

      <div className="flex flex-col gap-1">
        <span className="truncate font-medium">
          {name || "Student"}
        </span>
        {children}
      </div>
    </div>
  );
}

interface ReviewCommentProps {
  comment?: string | null;
}

export function ReviewComment({ comment }: ReviewCommentProps) {
  const [expanded, setExpanded] = useState(false);

  if (!comment?.trim()) {
    return (
      <p className="text-sm italic text-muted-foreground">
        No written comment.
      </p>
    );
  }

  // Only show the toggle for comments likely to exceed the collapsed height.
  const canExpand = comment.length > 180;

  return (
    <div className="space-y-1">
      <p
        className={`whitespace-pre-wrap wrap-break-word text-sm leading-relaxed ${
          expanded ? "" : "line-clamp-2"
        }`}
      >
        {comment}
      </p>

      {canExpand && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="text-sm font-medium text-primary hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}