/** Displayed availability / inventory is advisory (M8 #73 — full copy polish in #74). */
export function AdvisoryBanner() {
  return (
    <p className="advisory-banner" role="note">
      Advisory only — seat counts and availability are not authoritative. Confirm outcome via booking
      status, not displayed inventory.
    </p>
  );
}
