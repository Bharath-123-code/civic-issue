import re
from typing import Dict

# Controlled Category to Department Mapping
CATEGORY_DEPARTMENTS: Dict[str, str] = {
    "Pothole": "Public Works",
    "Road Damage": "Public Works",
    "Garbage": "Sanitation",
    "Lighting": "Electrical / Street Lighting",
    "Drainage": "Public Works",
    "Water Leakage": "Water Supply",
    "Traffic/Signage": "Traffic / Transport",
    "Other": "Municipal Services",
}

# Canned Admin Work-Order Actions per Category
FALLBACK_ADMIN_ACTIONS: Dict[str, str] = {
    "Pothole": (
        "Create a Public Works work order to inspect and repair the reported "
        "road hazard. Prioritize an on-site safety assessment."
    ),
    "Road Damage": (
        "Assign Public Works maintenance crew to evaluate structural road "
        "damage and schedule resurfacing."
    ),
    "Garbage": (
        "Create a sanitation work order for inspection and waste collection at "
        "the reported location."
    ),
    "Lighting": (
        "Create a street-light maintenance work order to inspect the reported "
        "lighting issue and replace or repair the faulty unit."
    ),
    "Drainage": (
        "Assign the issue to Public Works for drainage inspection and "
        "corrective maintenance."
    ),
    "Water Leakage": (
        "Create a Water Supply maintenance request to inspect the reported "
        "leakage and prevent further water loss."
    ),
    "Traffic/Signage": (
        "Assign Traffic / Transport department to inspect and repair damaged "
        "or malfunctioning traffic control infrastructure."
    ),
    "Other": (
        "Forward report to Municipal Services triage team for on-site "
        "assessment and appropriate department dispatch."
    ),
}

# Regex classification rules (ordered by specificity)
CATEGORY_PATTERNS = [
    (
        "Water Leakage",
        re.compile(
            r"\b(water\s*(?:leak|leakage|main|supply|pipe|line)|pipe\s*burst|"
            r"burst\s*pipe|pipeline|leaking\s*pipe|gushing\s*water|tap\s*leak|"
            r"broken\s*pipe)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Drainage",
        re.compile(
            r"\b(drain|drainage|sewer|sewerage|manhole|sewage|clogged\s*drain|"
            r"waterlog(?:ging)?|gutter|storm\s*drain|flooded\s*(?:street|road)|"
            r"overflowing\s*drain)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Pothole",
        re.compile(
            r"\b(pothole|pot\s*hole|crater|road\s*hole|asphalt\s*crater|"
            r"sink\s*hole|sinkhole|deep\s*hole)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Road Damage",
        re.compile(
            r"\b(road\s*damage|broken\s*road|damaged\s*road|cracked\s*road|"
            r"uneven\s*road|cave-?in|asphalt\s*damage|road\s*surface|"
            r"pavement\s*damage|curb\s*damage)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Lighting",
        re.compile(
            r"\b(street\s*light|streetlight|lamp\s*post|light\s*pole|bulb|"
            r"dark\s*street|darkness|no\s*light|lighting|blackout|street\s*lamp|"
            r"flickering\s*light|dark)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Garbage",
        re.compile(
            r"\b(garbage|trash|waste|rubbish|litter|dustbin|trash\s*can|"
            r"dump(?:ing)?|debris|refuse|stench|waste\s*pile|overflowing\s*bin)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "Traffic/Signage",
        re.compile(
            r"\b(traffic\s*(?:signal|light|sign|jam|congest)|stop\s*sign|"
            r"speed\s*breaker|zebra\s*crossing|signboard|road\s*sign|divider|"
            r"traffic\s*pole|traffic\s*cone)\b",
            re.IGNORECASE,
        ),
    ),
]

# Priority indicator keywords/patterns
HIGH_PRIORITY_PATTERN = re.compile(
    r"\b(danger(?:ous)?|hazard|deep|huge|massive|emergency|crash|accident|"
    r"injur(?:y|ed)|bleed|burst|gushing|flood(?:ing)?|collapse|collapsed|"
    r"live\s*wire|spark(?:ing)?|open\s*manhole|sinkhole|severe|critical|"
    r"immediate|life-threatening)\b",
    re.IGNORECASE,
)

LOW_PRIORITY_PATTERN = re.compile(
    r"\b(litter|small|minor|graffiti|faded|slow|cosmetic|dust|dirt|slight)\b",
    re.IGNORECASE,
)


def fallback_evaluate_issue(description: str) -> dict:
    """
    Deterministic, zero-dependency fallback evaluation for civic issues.
    Uses regex keyword matching to identify category, priority, and department.

    Args:
        description: Citizen issue description text.

    Returns:
        dict: {"category": str, "priority": str, "department": str}
    """
    if not description or not description.strip():
        return {
            "category": "Other",
            "priority": "Low",
            "department": CATEGORY_DEPARTMENTS["Other"],
        }

    clean_text = description.strip()

    # Identify category
    matched_category = "Other"
    for category_name, pattern in CATEGORY_PATTERNS:
        if pattern.search(clean_text):
            matched_category = category_name
            break

    # Determine priority
    if HIGH_PRIORITY_PATTERN.search(clean_text):
        priority = "High"
    elif LOW_PRIORITY_PATTERN.search(clean_text) and matched_category in (
        "Garbage",
        "Traffic/Signage",
        "Other",
    ):
        priority = "Low"
    else:
        # Default category-aware base priorities
        if matched_category in ("Pothole", "Drainage", "Water Leakage"):
            # Civic safety issues default to High or Medium
            priority = "High" if "pothole" in clean_text.lower() or "burst" in clean_text.lower() else "Medium"
        elif matched_category == "Other":
            priority = "Low"
        else:
            priority = "Medium"

    department = CATEGORY_DEPARTMENTS.get(
        matched_category, CATEGORY_DEPARTMENTS["Other"]
    )

    return {
        "category": matched_category,
        "priority": priority,
        "department": department,
    }


def fallback_admin_action(category: str) -> str:
    """
    Returns a deterministic, professional canned admin work-order action.

    Args:
        category: The issue category (e.g. 'Pothole', 'Lighting', etc.)

    Returns:
        str: Concise administrative work order action.
    """
    return FALLBACK_ADMIN_ACTIONS.get(
        category, FALLBACK_ADMIN_ACTIONS["Other"]
    )

