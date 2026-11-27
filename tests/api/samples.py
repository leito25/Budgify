LOAN = {
    "name": "Test loan",
    "description": "For tests",
    "principalMinor": 18_000_000_000,
    "termMonths": 12,
    "rate": 0.2,
    "rateBasis": "effective_annual",
    "interestType": "compound",
    "penaltyRateAnnual": 0.1,
    "firstDueDate": "2026-12-01",
}

PAYMENT = {
    "installmentIndex": 0,
    "paidDate": "2026-11-23",
    "scheduledAmountMinor": 1_000_000,
    "penaltyMinor": 0,
    "totalPaidMinor": 1_000_000,
}

INCOME = {
    "source": "Test sales",
    "description": "",
    "amountMinor": 3_000_000_000,
    "dateReceived": "2026-11-20",
    "frequency": "recurring",
}
