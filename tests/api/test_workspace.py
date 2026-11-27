def test_the_workspace_starts_with_the_sample_data(client, ana):
    workspace = client.get("/api/workspace", headers=ana).json()
    assert workspace["region"] == "CO"
    assert workspace["baseCurrency"] == "COP"
    assert [loan["name"] for loan in workspace["loans"]] == [
        "Bakery oven",
        "Coffee equipment",
        "Delivery equipment",
    ]
    assert len(workspace["income"]) == 2
    assert workspace["payments"] == []


def test_every_signed_in_person_sees_the_same_workspace(client, ana, sam):
    first = client.get("/api/workspace", headers=ana).json()
    second = client.get("/api/workspace", headers=sam).json()
    assert first == second
