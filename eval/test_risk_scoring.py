from ingestion.risk_scoring import compute_risk, propensity_factor


def test_creux_route_ponctuelle_est_faible():
    score, band = compute_risk(hour=3, concurrent=1, route_hist_delay_min=0)
    assert band == "faible"


def test_pointe_congestionnee_route_a_retard_est_eleve():
    score, band = compute_risk(hour=8, concurrent=40, route_hist_delay_min=30)
    assert band == "eleve"


def test_propension_bornee_a_1():
    assert propensity_factor(120) == 1.0


def test_route_inconnue_pas_de_propension():
    assert propensity_factor(None) == 0.0
