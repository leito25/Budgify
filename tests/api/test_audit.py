from tests.api.samples import INCOME, LOAN, PAYMENT

ANA = {"id": "test-person-ana", "name": "Ana Test", "email": "ana@budgify.ng"}
SAM = {"id": "test-person-sam", "name": None, "email": "sam@budgify.ng"}


def test_a_new_loan_records_who_added_it(client, ana):
    loan = client.post("/api/loans", json=LOAN, headers=ana).json()
    assert loan["addedBy"] == ANA
    assert loan["changedBy"] == ANA
    assert loan["addedAt"] == loan["changedAt"] == "2026-11-23T12:00:00+00:00"


def test_the_request_cannot_set_the_audit_fields(client, ana):
    forged = {**LOAN, "addedBy": SAM, "changedBy": "test-person-sam", "addedAt": "2000"}
    loan = client.post("/api/loans", json=forged, headers=ana).json()
    assert loan["addedBy"] == ANA
    assert loan["addedAt"].startswith("2026")


def test_an_edit_changes_who_changed_it_and_keeps_who_added_it(client, ana, sam, clock):
    loan = client.post("/api/loans", json=LOAN, headers=ana).json()
    clock.advance(5)
    edited = client.put(f"/api/loans/{loan['id']}", json=LOAN, headers=sam).json()
    assert edited["addedBy"] == ANA
    assert edited["changedBy"] == SAM
    assert edited["addedAt"] == loan["addedAt"]
    assert edited["changedAt"] == "2026-11-23T12:05:00+00:00"


def test_income_records_who_added_and_changed_it(client, ana, sam):
    entry = client.post("/api/income", json=INCOME, headers=ana).json()
    assert entry["addedBy"] == ANA
    edited = client.put(f"/api/income/{entry['id']}", json=INCOME, headers=sam).json()
    assert (edited["addedBy"], edited["changedBy"]) == (ANA, SAM)


def test_settling_records_who_settled(client, ana, sam):
    loan = client.post("/api/loans", json=LOAN, headers=ana).json()
    forged = {**PAYMENT, "settledBy": "test-person-ana"}
    payment = client.post(
        f"/api/loans/{loan['id']}/payments", json=forged, headers=sam
    ).json()
    assert payment["settledBy"] == SAM
    assert payment["addedBy"] == SAM
    assert payment["settledAt"] == "2026-11-23T12:00:00+00:00"


def test_a_person_without_a_name_is_shown_by_email(client, sam):
    loan = client.post("/api/loans", json=LOAN, headers=sam).json()
    assert loan["addedBy"]["name"] is None
    assert loan["addedBy"]["email"] == "sam@budgify.ng"


def test_an_edit_cannot_set_the_audit_fields_either(client, ana, sam):
    loan = client.post("/api/loans", json=LOAN, headers=ana).json()
    forged = {**LOAN, "addedBy": SAM, "changedBy": ANA, "changedAt": "2000"}
    edited = client.put(f"/api/loans/{loan['id']}", json=forged, headers=sam).json()
    assert (edited["addedBy"], edited["changedBy"]) == (ANA, SAM)
    assert edited["changedAt"].startswith("2026")


def test_the_workspace_shows_who_added_and_settled(client, ana, sam):
    loan = client.post("/api/loans", json=LOAN, headers=ana).json()
    client.post(f"/api/loans/{loan['id']}/payments", json=PAYMENT, headers=sam)
    workspace = client.get("/api/workspace", headers=ana).json()
    payment = workspace["payments"][0]
    assert (payment["addedBy"], payment["settledBy"]) == (SAM, SAM)
    stored = [x for x in workspace["loans"] if x["id"] == loan["id"]]
    assert stored[0]["addedBy"] == ANA
