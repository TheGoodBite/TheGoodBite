export function MeezanyLogo({ wordmark = true }: { wordmark?: boolean }) {
  return (
    <span className="brand" aria-label="Meezany">
      <img src="/brand/meezany-mark.svg" width="48" height="28" alt="" />
      {wordmark && <span>Meezany</span>}
    </span>
  );
}
