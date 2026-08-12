"""Score de risque retard : deterministe, borne, tracable.

Le score est PROSPECTIF : il n'utilise pas le retard reel du vol lui-meme
(ce serait tricher), mais des facteurs connus a l'avance :
  - congestion : nb de mouvements sur le meme creneau/aeroport
  - creneau horaire : pointe / epaule / creux
  - propension de la liaison : retard moyen historique de la route

  risk = 100 * (0.40*congestion + 0.25*creneau + 0.35*propension)

Le retard reel est stocke a part, pour BACKTESTER le score (Jour 4).
"""

PEAK_HOURS = {7, 8, 9, 17, 18, 19, 20}
SHOULDER_HOURS = {6, 10, 11, 16, 21}
DEFAULT_CONGESTION_CAP = 40
DELAY_SATURATION_MIN = 30

W_CONGESTION = 0.40
W_HOUR = 0.25
W_PROPENSITY = 0.35


def hour_factor(hour: int) -> float:
    if hour in PEAK_HOURS:
        return 1.0
    if hour in SHOULDER_HOURS:
        return 0.6
    return 0.3


def congestion_factor(concurrent: int, cap: int = DEFAULT_CONGESTION_CAP) -> float:
    return min(max(concurrent, 0) / cap, 1.0)


def propensity_factor(route_hist_delay_min) -> float:
    # Retard moyen historique de la liaison. 0 si inconnu. 30 min -> saturation.
    if not route_hist_delay_min or route_hist_delay_min <= 0:
        return 0.0
    return min(route_hist_delay_min / DELAY_SATURATION_MIN, 1.0)


def band_of(score: int) -> str:
    if score > 66:
        return "eleve"
    if score >= 34:
        return "modere"
    return "faible"


def compute_risk(hour, concurrent, route_hist_delay_min=None,
                 cap: int = DEFAULT_CONGESTION_CAP):
    """Retourne (score:int 0-100, band:str)."""
    c = congestion_factor(concurrent, cap)
    h = hour_factor(hour)
    p = propensity_factor(route_hist_delay_min)
    score = round(100 * (W_CONGESTION * c + W_HOUR * h + W_PROPENSITY * p))
    score = max(0, min(100, score))
    return score, band_of(score)
