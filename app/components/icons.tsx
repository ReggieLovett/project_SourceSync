import type { ReactNode } from "react";

// One authored icon set: 24px grid, 1.6 stroke, square caps and mitred joins to
// match the square-cornered UI. Decorative; the buttons carry their own labels.

type IconProps = { size?: number };

function Icon({ size = 20, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5h16v11H10.5L6 19.5V16H4z" />
    </Icon>
  );
}

/** A seal with a tick: the checker. */
export function CheckerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="16" height="16" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </Icon>
  );
}

export function ImportIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v10M8 10.5l4 4 4-4M4 15v5h16v-5" />
    </Icon>
  );
}

/** Stacked sheets: many items at once. */
export function BatchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="8" y="4" width="12" height="12" />
      <path d="M4.5 8v11.5H16" />
    </Icon>
  );
}

export function AttachIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5.5v13M5.5 12h13" />
    </Icon>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 19V5.5M6.5 11L12 5.5 17.5 11" />
    </Icon>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="7.5" y="7.5" width="9" height="9" fill="currentColor" />
    </Icon>
  );
}
