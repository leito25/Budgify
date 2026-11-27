import pytest

from tests.api.samples import INCOME, LOAN


def search(client, headers, text):
    response = client.get("/api/search", params={"q": text}, headers=headers)
    assert response.status_code == 200
    return response.json()


def add(client, headers, path, body):
    assert client.post(path, json=body, headers=headers).status_code == 201


@pytest.mark.parametrize("text", ["oven", "OVEN", "ake", "Bakery Oven"])
def test_finds_part_of_a_name_in_any_case(client, ana, text):
    results = search(client, ana, text)
    assert [(r["kind"], r["name"]) for r in results] == [("loan", "Bakery oven")]


def test_finds_loans_and_income_together(client, ana):
    results = search(client, ana, "pan")
    assert [(r["kind"], r["name"]) for r in results] == [
        ("income", "Panadería seasonal order")
    ]
    add(client, ana, "/api/loans", {**LOAN, "name": "Pan mixer"})
    kinds = {r["kind"] for r in search(client, ana, "PAN")}
    assert kinds == {"loan", "income"}


def test_accented_names_match_in_any_case(client, ana):
    assert search(client, ana, "PANADERÍA")[0]["name"] == "Panadería seasonal order"
    assert search(client, ana, "panadería")[0]["name"] == "Panadería seasonal order"


@pytest.mark.parametrize("text", ["%", "_", "\\", "a%r", "b_k"])
def test_wildcard_characters_are_plain_characters(client, ana, text):
    assert search(client, ana, text) == []


def test_a_percent_in_a_name_is_found(client, ana):
    add(client, ana, "/api/income", {**INCOME, "source": "Bonus 100% paid"})
    assert [r["name"] for r in search(client, ana, "100%")] == ["Bonus 100% paid"]
    assert [r["name"] for r in search(client, ana, "s_p")] == []


def test_the_escape_character_and_backslash_are_plain_characters(client, ana):
    add(client, ana, "/api/income", {**INCOME, "source": "Tip!! and a\\b"})
    assert [r["name"] for r in search(client, ana, "!!")] == ["Tip!! and a\\b"]
    assert [r["name"] for r in search(client, ana, "a\\b")] == ["Tip!! and a\\b"]
    assert search(client, ana, "!") != []
    assert search(client, ana, "!x") == []


def test_each_kind_is_limited_to_twenty_results(client, ana):
    for number in range(25):
        add(client, ana, "/api/loans", {**LOAN, "name": f"Many {number:02}"})
    names = [r["name"] for r in search(client, ana, "many")]
    assert names == [f"Many {number:02}" for number in range(20)]


def test_nothing_matches_and_blank_gives_no_results(client, ana):
    assert search(client, ana, "zzz") == []
    assert search(client, ana, "   ") == []


def test_signed_out_is_refused(client):
    assert client.get("/api/search", params={"q": "pan"}).status_code == 401
