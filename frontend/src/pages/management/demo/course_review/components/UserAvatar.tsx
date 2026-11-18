import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

interface UserAvatarProps {
  name?: string | null;
  className?: string;
}

const avatarColors = [
  "bg-red-100 text-red-700",
  "bg-orange-100 text-orange-700",
  "bg-amber-100 text-amber-700",
  "bg-green-100 text-green-700",
  "bg-teal-100 text-teal-700",
  "bg-blue-100 text-blue-700",
  "bg-indigo-100 text-indigo-700",
  "bg-purple-100 text-purple-700",
  "bg-pink-100 text-pink-700",
];

function getInitials(name?: string | null) {
  if (!name?.trim()) return "U";

  const words = name.trim().split(/\s+/);

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (
    words[0][0] + words[words.length - 1][0]
  ).toUpperCase();
}

function getAvatarColor(name?: string | null) {
  const value = name || "User";

  const hash = Array.from(value).reduce(
    (acc, char) => acc + char.charCodeAt(0),
    0,
  );

  return avatarColors[hash % avatarColors.length];
}

export function UserAvatar({
  name,
  className,
}: UserAvatarProps) {
  const initials = getInitials(name);
  const colorClass = getAvatarColor(name);

  return (
    <Avatar className={className}>
      <AvatarImage
        src={ undefined}
        alt={name || "User"}
      />

      <AvatarFallback
        className={`font-semibold ${colorClass}`}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}