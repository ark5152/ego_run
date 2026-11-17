const P = {
  home: "M4 11l8-7 8 7v9H4z",
  roll: "M6 4h12v16H6z M9 9l2 2 4-4 M9 15h6",
  cal: "M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4",
  trophy: "M8 4h8v6a4 4 0 01-8 0z M12 14v4 M8 20h8 M8 6H5v2a3 3 0 003 3 M16 6h3v2a3 3 0 01-3 3",
  menu: "M5 7h14 M5 12h14 M5 17h14",
  left: "M15 6l-6 6 6 6",
  right: "M9 6l6 6-6 6",
  down: "M6 9l6 6 6-6",
  back: "M15 5l-7 7 7 7",
  plus: "M12 5v14 M5 12h14",
  trash: "M5 7h14 M10 11v6 M14 11v6 M7 7l1 13h8l1-13 M9 7V4h6v3",
  camera: "M4 8h4l2-3h4l2 3h4v11H4z M12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7",
} as const;

export type IconName = keyof typeof P;

export function Icon({ name, small }: { name: IconName; small?: boolean }) {
  return (
    <svg className={small ? "ic s" : "ic"} viewBox="0 0 24 24" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  );
}

export function Crown() {
  return (
    <svg className="cr" viewBox="0 0 24 24" role="img" aria-label="1위">
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
    </svg>
  );
}
