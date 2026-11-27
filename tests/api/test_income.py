from tests.api.samples import INCOME


def create(client, headers, **changes):
    response = client.post("/api/income", json={**INCOME, **changes}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_an_income_entry_can_be_created_and_read(client, ana):
    entry = create(client, ana)
    assert entry["source"] == "Test sales"
    listed = client.get("/api/workspace", headers=ana).json()["income"]
    assert entry in listed


def test_amounts_above_32_bits_are_kept(client, ana):
    entry = create(client, ana, amountMinor=9_000_000_000)
    assert entry["amountMinor"] == 9_000_000_000


def test_an_income_entry_can_be_updated_and_deleted(client, ana):
    entry = create(client, ana)
    url = f"/api/income/{entry['id']}"
    response = client.put(url, json={**INCOME, "source": "Renamed"}, headers=ana)
    assert response.json()["source"] == "Renamed"
    assert client.delete(url, headers=ana).status_code == 204
    ids = [x["id"] for x in client.get("/api/workspace", headers=ana).json()["income"]]
    assert entry["id"] not in ids


def test_unknown_entries_are_not_found(client, ana):
    assert client.put("/api/income/nope", json=INCOME, headers=ana).status_code == 404
    assert client.delete("/api/income/nope", headers=ana).status_code == 404


def test_invalid_entries_are_refused(client, ana):
    bad = {**INCOME, "frequency": "weekly"}
    assert client.post("/api/income", json=bad, headers=ana).status_code == 422
