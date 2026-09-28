export function MeezanyLogo({ wordmark = true }: { wordmark?: boolean }) {
  return (
    <span className="brand" aria-label="Meezany">
      <img src="/brand/meezany-orange-mark.png" width="256" height="256" alt="" />
      {wordmark && <span>Meezany</span>}
    </span>
  );
}
