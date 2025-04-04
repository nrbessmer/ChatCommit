
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_create_branch():
    response = client.post("/branch/", json={"name": "feature-xyz"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "feature-xyz"
    assert data["id"] is not None

def test_create_branch_from_commit():
    commit_resp = client.post("/commit/", json={
        "commit_message": "Setup for branching",
        "conversation_context": {"messages": ["Branching context"]}
    })
    commit_id = commit_resp.json()["id"]

    branch_resp = client.post(f"/branch/?commit_id={commit_id}", json={"name": "feature-from-commit"})
    assert branch_resp.status_code == 200
    data = branch_resp.json()
    assert data["head_commit_id"] == commit_id

def test_checkout_branch():
    branch_name = "feature-xyz"
    resp = client.get(f"/branch/{branch_name}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == branch_name
