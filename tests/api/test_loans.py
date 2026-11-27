from tests.api.samples import LOAN, PAYMENT


def create(client, headers, **changes):
    response = client.post("/api/loans", json={**LOAN, **changes}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def workspace(client, headers):
    return client.get("/api/workspace", headers=headers).json()


def test_a_loan_can_be_created_and_read(client, ana):
    loan = create(client, ana)
    assert loan["name"] == "Test loan"
    assert loan["firstDueDate"] == "2026-12-01"
    assert loan in workspace(client, ana)["loans"]


def test_amounts_above_32_bits_are_kept(client, ana):
    loan = create(client, ana, principalMinor=18_000_000_000)
    assert loan["principalMinor"] == 18_000_000_000
    stored = [x for x in workspace(client, ana)["loans"] if x["id"] == loan["id"]]
    assert stored[0]["principalMinor"] == 18_000_000_000


def test_a_loan_can_be_updated(client, ana):
    loan = create(client, ana)
    response = client.put(
        f"/api/loans/{loan['id']}", json={**LOAN, "name": "Renamed"}, headers=ana
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed"
    assert response.json()["id"] == loan["id"]


def test_a_loan_can_be_deleted_with_its_payments(client, ana):
    loan = create(client, ana)
    client.post(f"/api/loans/{loan['id']}/payments", json=PAYMENT, headers=ana)
    assert client.delete(f"/api/loans/{loan['id']}", headers=ana).status_code == 204
    after = workspace(client, ana)
    assert loan["id"] not in [x["id"] for x in after["loans"]]
    assert after["payments"] == []


def test_an_installment_can_be_settled_once(client, ana):
    loan = create(client, ana)
    url = f"/api/loans/{loan['id']}/payments"
    response = client.post(url, json=PAYMENT, headers=ana)
    assert response.status_code == 201
    assert response.json()["totalPaidMinor"] == 1_000_000
    assert client.post(url, json=PAYMENT, headers=ana).status_code == 409
    assert len(workspace(client, ana)["payments"]) == 1


def test_a_large_payment_is_kept(client, ana):
    loan = create(client, ana)
    big = {
        **PAYMENT,
        "scheduledAmountMinor": 9_000_000_000,
        "totalPaidMinor": 9_000_000_000,
    }
    response = client.post(f"/api/loans/{loan['id']}/payments", json=big, headers=ana)
    assert response.json()["totalPaidMinor"] == 9_000_000_000


def test_unknown_loans_are_not_found(client, ana):
    assert client.put("/api/loans/nope", json=LOAN, headers=ana).status_code == 404
    assert client.delete("/api/loans/nope", headers=ana).status_code == 404
    url = "/api/loans/nope/payments"
    assert client.post(url, json=PAYMENT, headers=ana).status_code == 404


def test_invalid_loans_are_refused(client, ana):
    for changes in ({"name": " "}, {"principalMinor": 0}, {"termMonths": 0}):
        response = client.post("/api/loans", json={**LOAN, **changes}, headers=ana)
        assert response.status_code == 422
