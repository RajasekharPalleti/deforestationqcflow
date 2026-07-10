ROLES = ["PM", "QA", "DS"]

DEPARTMENTS = {
    "Quality Assurance": "QA",
    "Data Science": "DS",
    "Product": "PM",
    "Others": "OTHER",
}

TENANTS = ["BAT Brazil", "BAT Indonesia", "BAT Bangladesh", "ITC India", "Demo Tenant"]

TENANT_PROJECTS = {
    "BAT Brazil": ["BAT Brazil — New Growers", "BAT Brazil — Existing Growers", "BAT Brazil — Pilot 2024"],
    "BAT Indonesia": ["BAT Indonesia — New Growers", "BAT Indonesia — Existing Growers"],
    "BAT Bangladesh": ["BAT Bangladesh — New Growers", "BAT Bangladesh — Existing Growers"],
    "ITC India": ["ITC Leaf Tobacco — Karnataka", "ITC Leaf Tobacco — Andhra Pradesh"],
    "Demo Tenant": ["Demo Project A", "Demo Project B"],
}

MODELS = {
    "Deforestation": {
        "icon": "🌳",
        "description": "Satellite-based deforestation detection",
        "review_columns": ["deforestation_date", "deforested_area_ha", "confidence_score"],
        "qa_statuses": ["Pending", "Deforested", "Not Deforested", "Inconclusive"],
        "ds_statuses": ["Pending", "Confirmed Deforested", "Confirmed Not Deforested", "Inconclusive"],
        "qa_reasons": ["", "Forest Boundary", "Plantation", "Cloud Issue",
                       "No Change Visible", "Urban / Built-up Area",
                       "Water Body Misclassification", "Seasonality Effect", "Other"],
    },
}

CARD_FILTERS = {
    "total": {},
    "published": {"publish_status": "published"},
    "unpublished": {"publish_status": "unpublished"},
    "published_deforested": {"publish_status": "published", "detection_status": "Deforested"},
    "published_not_deforested": {"publish_status": "published", "detection_status": "Not Deforested"},
    "qa_pending": {"qa_status": "Pending", "publish_status": "unpublished"},
    "qa_done": {},
    "ready_publish": {},
}
